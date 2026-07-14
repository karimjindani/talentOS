export function renderIndex() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TalentOS Local Operations</title>
  <script>
    (() => {
      let storedTheme = "light";
      try {
        storedTheme = localStorage.getItem("opsTheme") || "light";
      } catch {
        storedTheme = "light";
      }
      document.documentElement.dataset.theme = storedTheme === "dark" ? "dark" : "light";
    })();
  </script>
  <link rel="stylesheet" href="/assets/styles.css" />
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">TO</div>
        <div>
          <div class="eyebrow">Local host operations</div>
          <h1>TalentOS Local Operations</h1>
          <p>Out-of-band health checks, regression execution, and local reset controls.</p>
        </div>
      </div>
      <div class="top-meta">
        <span class="pill neutral">127.0.0.1:3300</span>
        <button id="themeToggle" class="theme-toggle" type="button" aria-label="Switch color theme" aria-pressed="false">
          <span class="theme-dot" aria-hidden="true"></span>
          <span id="themeLabel">Dark</span>
        </button>
        <time id="clock"></time>
      </div>
    </header>

    <section class="panel actions">
      <div class="section-head">
        <h2>Actions</h2>
        <p>Keycloak session controls access. 2FA changes apply on next login.</p>
      </div>
      <div class="action-grid">
        <div class="auth-box">
          <div>
            <div class="panel-kicker">Keycloak session</div>
            <h3 id="sessionTitle">Checking session</h3>
            <p id="sessionDetail">Validating local operations access.</p>
          </div>
          <div class="auth-controls">
            <label class="switch-row" for="mfaToggle">
              <span>
                <strong>Require 2FA</strong>
                <small>Applies on next login</small>
              </span>
              <input id="mfaToggle" type="checkbox" role="switch" />
            </label>
            <a id="logoutLink" class="auth-button" href="/logout">Logout</a>
          </div>
        </div>
        <div class="command-bar" aria-label="Operations actions">
          <button id="healthBtn" class="command-button primary" type="button">
            <span class="button-kicker">Check</span>
            <span>Health</span>
          </button>
          <label class="area-select-label" for="regressionArea">
            <span>Regression Area</span>
            <select id="regressionArea" class="area-select">
              <option value="all">All areas</option>
              <option value="unit">Unit</option>
              <option value="auth">Auth</option>
              <option value="applicant">Applicant</option>
              <option value="admin">Admin</option>
              <option value="programs">Programs</option>
              <option value="missions">Missions</option>
              <option value="journal">Journal</option>
              <option value="tenant">Tenant isolation</option>
              <option value="dashboard">Dashboard</option>
              <option value="storage">Storage</option>
              <option value="ops">Ops</option>
            </select>
          </label>
          <button id="selectedRegressionBtn" class="command-button" type="button">
            <span class="button-kicker">Run</span>
            <span>Selected</span>
          </button>
          <button id="regressionBtn" class="command-button" type="button">
            <span class="button-kicker">Run</span>
            <span>Full Regression</span>
          </button>
          <button id="cleanupBtn" class="command-button" type="button">
            <span class="button-kicker">Clean</span>
            <span>Test Data</span>
          </button>
          <button id="resetBtn" class="command-button danger" type="button">
            <span class="button-kicker">Fresh</span>
            <span>Reset</span>
          </button>
        </div>
      </div>
      <p id="summary" class="notice info">Loading Keycloak session.</p>
    </section>

    <section class="panel">
      <div class="section-head inline">
        <div>
          <h2>Components</h2>
          <p>Host, container, database, and service reachability.</p>
        </div>
        <div id="componentSummary" class="status-rollup" aria-live="polite"></div>
      </div>
      <div id="components" class="grid"></div>
    </section>

    <section class="panel">
      <div class="section-head">
        <h2>Browser Client Path</h2>
        <p>These checks run from this browser and catch localhost reachability issues separately from host checks.</p>
      </div>
      <div id="browserChecks" class="grid three"></div>
    </section>

    <div id="resultsRegion" class="lower-grid">
      <section id="jobPanel" class="panel job-panel">
        <div class="section-head inline job-head">
          <div>
            <div id="jobEyebrow" class="panel-kicker">Execution status</div>
            <h2 id="jobTitle">Operation Results</h2>
            <p id="jobMeta">Choose an action above to start a run.</p>
          </div>
          <span id="jobStatus" class="pill neutral">idle</span>
        </div>
        <div id="steps" class="steps">
          <div class="empty-state">Run Regression, Clean Test Data, or Reset to see command progress here.</div>
        </div>
      </section>

      <section class="panel output-panel">
        <div class="section-head inline">
          <div>
            <div class="panel-kicker">Raw stream</div>
            <h2 id="outputTitle">Execution Output</h2>
            <p id="outputMeta">Raw job logs and API responses.</p>
          </div>
          <span id="outputState" class="pill neutral">idle</span>
        </div>
        <pre id="output">{}</pre>
      </section>
    </div>
  </main>
  <script src="/assets/app.js"></script>
</body>
</html>`;
}

export const stylesCss = `
:root {
  color-scheme: light;
  --bg: #eef3f8;
  --body-glow: linear-gradient(180deg, #dfeaf5 0%, rgba(223, 234, 245, 0) 100%);
  --surface: #ffffff;
  --surface-strong: #f8fafc;
  --panel-bg: rgba(255, 255, 255, 0.94);
  --card-bg: #ffffff;
  --input-bg: #fbfdff;
  --input-focus-bg: #ffffff;
  --input-border: #b4c5d8;
  --input-hover-border: #8aa8c6;
  --line: #d4dee9;
  --line-soft: #e6edf5;
  --ink: #0b1424;
  --muted: #546378;
  --kicker: #2d607f;
  --blue: #1769aa;
  --blue-dark: #105184;
  --navy: #27384f;
  --navy-hover: #1f3047;
  --green: #047857;
  --green-soft: #e8fbf3;
  --green-border: #9de8c5;
  --amber: #b45309;
  --amber-soft: #fff7df;
  --amber-border: #f4d57c;
  --red: #bf1d12;
  --red-dark: #9f160d;
  --red-soft: #fff0ee;
  --red-border: #f2afa8;
  --brand-bg: #09233f;
  --brand-border: #b8cce1;
  --brand-text: #dff7ee;
  --brand-shadow: 0 8px 18px rgba(9, 35, 63, 0.18);
  --chip-bg: #f4f8fc;
  --chip-text: #41516a;
  --card-detail: #3d4c62;
  --metric: #66758a;
  --meta-bg: #f8fbfe;
  --meta-text: #43536a;
  --step-bg: #ffffff;
  --step-code: #536277;
  --empty-bg: #f8fbfe;
  --console-bg: #0d1524;
  --console-border: #172033;
  --console-text: #d8e1ef;
  --scrollbar-thumb: #31415b;
  --shadow: 0 16px 40px rgba(24, 39, 75, 0.08);
  --button-shadow: 0 8px 18px rgba(20, 35, 54, 0.14);
  --button-shadow-hover: 0 11px 22px rgba(20, 35, 54, 0.2);
  --button-shadow-active: 0 5px 12px rgba(20, 35, 54, 0.18);
  --button-shadow-running: 0 0 0 3px rgba(23, 105, 170, 0.16), 0 10px 20px rgba(20, 35, 54, 0.16);
  --card-hover-shadow: 0 10px 24px rgba(24, 39, 75, 0.1);
  --focus-ring: rgba(23, 105, 170, 0.26);
  --input-focus-shadow: 0 0 0 3px rgba(23, 105, 170, 0.14);
  --theme-dot-ring: 0 0 0 3px var(--amber-soft);
  --job-idle-border: #7d95ad;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--ink);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0c111a;
  --body-glow: linear-gradient(180deg, #18263a 0%, rgba(24, 38, 58, 0) 100%);
  --surface: #151d2a;
  --surface-strong: #111a28;
  --panel-bg: rgba(18, 26, 38, 0.94);
  --card-bg: #111927;
  --input-bg: #0f1724;
  --input-focus-bg: #111d2d;
  --input-border: #32445c;
  --input-hover-border: #4b6583;
  --line: #2b3c53;
  --line-soft: #24354a;
  --ink: #edf3fb;
  --muted: #9bacbf;
  --kicker: #78b7d9;
  --blue: #2f8dcc;
  --blue-dark: #2473a9;
  --navy: #304158;
  --navy-hover: #3a506c;
  --green: #34d399;
  --green-soft: rgba(6, 95, 70, 0.32);
  --green-border: rgba(52, 211, 153, 0.5);
  --amber: #fbbf24;
  --amber-soft: rgba(146, 88, 16, 0.3);
  --amber-border: rgba(251, 191, 36, 0.48);
  --red: #f87171;
  --red-dark: #dc2626;
  --red-soft: rgba(127, 29, 29, 0.34);
  --red-border: rgba(248, 113, 113, 0.48);
  --brand-bg: #07111f;
  --brand-border: #35506c;
  --brand-text: #baf7e7;
  --brand-shadow: 0 10px 22px rgba(0, 0, 0, 0.34);
  --chip-bg: #182235;
  --chip-text: #b9c6d8;
  --card-detail: #b5c2d4;
  --metric: #9caac0;
  --meta-bg: #111b2a;
  --meta-text: #b6c4d6;
  --step-bg: #111927;
  --step-code: #aebbd0;
  --empty-bg: #101a29;
  --console-bg: #070b14;
  --console-border: #22324a;
  --console-text: #d8e6f7;
  --scrollbar-thumb: #445a78;
  --shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
  --button-shadow: 0 10px 22px rgba(0, 0, 0, 0.22);
  --button-shadow-hover: 0 14px 30px rgba(0, 0, 0, 0.3);
  --button-shadow-active: 0 5px 12px rgba(0, 0, 0, 0.26);
  --button-shadow-running: 0 0 0 3px rgba(47, 141, 204, 0.24), 0 10px 20px rgba(0, 0, 0, 0.28);
  --card-hover-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
  --focus-ring: rgba(47, 141, 204, 0.34);
  --input-focus-shadow: 0 0 0 3px rgba(47, 141, 204, 0.22);
  --theme-dot-ring: 0 0 0 3px rgba(47, 141, 204, 0.22);
  --job-idle-border: #52677f;
}
* { box-sizing: border-box; }
html { min-width: 320px; }
body { margin: 0; }
body::before {
  content: "";
  position: fixed;
  inset: 0 0 auto;
  height: 170px;
  background: var(--body-glow);
  pointer-events: none;
}
.shell { position: relative; max-width: 1420px; margin: 0 auto; padding: 24px 22px 38px; }
.topbar {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  margin-bottom: 16px;
}
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.brand-mark {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--brand-border);
  border-radius: 8px;
  background: var(--brand-bg);
  color: var(--brand-text);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  box-shadow: var(--brand-shadow);
}
.eyebrow {
  margin-bottom: 2px;
  color: var(--kicker);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
h1 { margin: 0; font-size: 30px; line-height: 1.05; letter-spacing: 0; }
h2 { margin: 0; font-size: 18px; line-height: 1.2; letter-spacing: 0; }
p { margin: 5px 0 0; color: var(--muted); }
.top-meta { display: flex; align-items: center; gap: 10px; color: var(--muted); white-space: nowrap; }
.theme-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 28px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--chip-bg);
  color: var(--chip-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 850;
  padding: 5px 10px;
  transition: border-color 140ms ease, background 140ms ease, color 140ms ease, transform 120ms ease;
}
.theme-toggle:hover {
  border-color: var(--input-hover-border);
  transform: translateY(-1px);
}
.theme-toggle:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
.theme-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: var(--amber);
  box-shadow: var(--theme-dot-ring);
}
:root[data-theme="dark"] .theme-dot {
  background: var(--blue);
}
time { font-variant-numeric: tabular-nums; }
.panel {
  background: var(--panel-bg);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: var(--shadow);
  padding: 16px;
  margin-top: 14px;
}
.section-head { margin-bottom: 12px; }
.section-head.inline {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  align-items: start;
}
.section-head p { font-size: 13px; }
.panel-kicker {
  margin-bottom: 4px;
  color: var(--kicker);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.06em;
  line-height: 1;
  text-transform: uppercase;
}
.actions { border-top: 3px solid var(--blue); }
.action-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto;
  gap: 12px;
  align-items: end;
}
.auth-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-strong);
  padding: 10px 12px;
}
.auth-box h3 {
  margin: 0;
  font-size: 15px;
}
.auth-box p {
  font-size: 12px;
}
.auth-controls {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 8px;
  flex-wrap: wrap;
}
.switch-row {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card-bg);
  color: var(--ink);
  padding: 7px 10px;
  cursor: pointer;
}
.switch-row strong,
.switch-row small {
  display: block;
  line-height: 1.1;
}
.switch-row strong {
  font-size: 12px;
}
.switch-row small {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 750;
  text-transform: uppercase;
}
.switch-row input {
  appearance: none;
  position: relative;
  width: 42px;
  height: 22px;
  border: 1px solid var(--input-border);
  border-radius: 999px;
  background: var(--chip-bg);
  cursor: pointer;
  transition: background 140ms ease, border-color 140ms ease;
}
.switch-row input::before {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--muted);
  transition: transform 140ms ease, background 140ms ease;
}
.switch-row input:checked {
  border-color: var(--green-border);
  background: var(--green-soft);
}
.switch-row input:checked::before {
  background: var(--green);
  transform: translateX(19px);
}
.switch-row input:focus-visible,
.auth-button:focus-visible {
  outline: 3px solid var(--focus-ring);
  outline-offset: 2px;
}
.auth-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--navy);
  color: white;
  font-size: 12px;
  font-weight: 850;
  padding: 8px 12px;
  text-decoration: none;
  white-space: nowrap;
}
.auth-button:hover {
  filter: brightness(1.05);
}
.command-bar {
  display: grid;
  grid-template-columns: minmax(112px, auto) minmax(160px, 1fr) repeat(4, minmax(112px, auto));
  gap: 8px;
}
.area-select-label {
  display: grid;
  gap: 3px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
}
.area-select {
  min-height: 44px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  font-weight: 800;
  padding: 0 10px;
}
.command-button {
  min-height: 44px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 8px;
  background: var(--navy);
  color: white;
  cursor: pointer;
  font-weight: 800;
  padding: 8px 13px;
  text-align: left;
  box-shadow: var(--button-shadow);
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, opacity 120ms ease;
}
.command-button span { display: block; }
.button-kicker {
  margin-bottom: 1px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 10px;
  font-weight: 900;
  line-height: 1;
  text-transform: uppercase;
}
.command-button:hover {
  background: var(--navy-hover);
  box-shadow: var(--button-shadow-hover);
  transform: translateY(-1px);
}
.command-button:active { transform: translateY(0); box-shadow: var(--button-shadow-active); }
.command-button:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
.command-button.primary { background: var(--blue); }
.command-button.primary:hover { background: var(--blue-dark); }
.command-button.danger { background: var(--red); }
.command-button.danger:hover { background: var(--red-dark); }
.command-button.is-active {
  box-shadow: var(--button-shadow-running);
}
.command-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
  transform: none;
  box-shadow: none;
}
.command-button.is-active:disabled {
  opacity: 1;
  box-shadow: var(--button-shadow-running);
}
.notice {
  display: flex;
  align-items: center;
  min-height: 32px;
  margin-top: 12px;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: var(--surface-strong);
  color: var(--muted);
  padding: 7px 10px;
  font-size: 13px;
  font-weight: 650;
}
.notice.ok { border-color: var(--green-border); background: var(--green-soft); color: var(--green); }
.notice.warn { border-color: var(--amber-border); background: var(--amber-soft); color: var(--amber); }
.notice.error { border-color: var(--red-border); background: var(--red-soft); color: var(--red); }
.pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 850;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
}
.pill.neutral { background: var(--chip-bg); color: var(--chip-text); }
.pill.healthy, .pill.passed { border-color: var(--green-border); background: var(--green-soft); color: var(--green); }
.pill.degraded, .pill.queued, .pill.running, .pill.skipped { border-color: var(--amber-border); background: var(--amber-soft); color: var(--amber); }
.pill.unhealthy, .pill.failed { border-color: var(--red-border); background: var(--red-soft); color: var(--red); }
.status-rollup { display: flex; flex-wrap: wrap; justify-content: end; gap: 6px; min-height: 24px; }
.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}
.grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.card {
  position: relative;
  min-height: 96px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card-bg);
  padding: 12px 12px 12px 15px;
  overflow-wrap: anywhere;
  transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
}
.card::before {
  content: "";
  position: absolute;
  inset: 10px auto 10px 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--input-hover-border);
}
.card:hover {
  border-color: var(--input-hover-border);
  box-shadow: var(--card-hover-shadow);
  transform: translateY(-1px);
}
.card.healthy::before { background: var(--green); }
.card.degraded::before { background: var(--amber); }
.card.unhealthy::before { background: var(--red); }
.card.passed::before { background: var(--green); }
.card.failed {
  border-color: var(--red-border);
  background: var(--red-soft);
}
.card.failed::before { background: var(--red); }
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: start;
  gap: 8px;
}
.card h3 {
  margin: 1px 0 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.2;
}
.card-detail {
  margin-top: 8px;
  color: var(--card-detail);
  font-size: 13px;
  line-height: 1.28;
}
.metric {
  display: inline-flex;
  margin-right: 6px;
  color: var(--metric);
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}
.regression-area-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.regression-area-card .card-detail {
  display: grid;
  gap: 8px;
}
.regression-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.regression-count {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--meta-bg);
  color: var(--meta-text);
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}
.regression-count.failed {
  border-color: var(--red-border);
  background: var(--red-soft);
  color: var(--red);
}
.regression-count.skipped {
  border-color: var(--amber-border);
  background: var(--amber-soft);
  color: var(--amber);
}
.regression-scenario-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
}
.regression-scenario-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: start;
  border: 1px solid var(--line-soft);
  border-radius: 8px;
  background: var(--surface);
  padding: 9px 10px;
}
.regression-scenario-row.failed {
  border-color: var(--red-border);
  background: var(--red-soft);
}
.regression-scenario-row.skipped {
  border-color: var(--amber-border);
  background: var(--amber-soft);
}
.regression-scenario-name {
  color: var(--ink);
  font-size: 13px;
  font-weight: 850;
}
.regression-scenario-detail {
  margin-top: 4px;
  color: var(--meta-text);
  font-size: 12px;
  line-height: 1.35;
}
.regression-scenario-error {
  color: var(--red);
  font-weight: 750;
}
.lower-grid {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(420px, 1.1fr);
  gap: 14px;
  align-items: start;
  scroll-margin-top: 18px;
}
.job-panel { border-top: 3px solid var(--job-idle-border); }
.job-panel.active { border-top-color: var(--blue); }
.job-head { margin-bottom: 14px; }
#jobMeta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.meta-chip {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  border: 1px solid var(--line-soft);
  border-radius: 999px;
  background: var(--meta-bg);
  color: var(--meta-text);
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 750;
  line-height: 1;
}
.meta-chip strong {
  margin-left: 4px;
  color: var(--ink);
  font-weight: 900;
}
.steps { display: grid; gap: 10px; margin-top: 12px; }
.step {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--step-bg);
  padding: 11px 12px 11px 15px;
  overflow: hidden;
}
.step::before {
  content: "";
  position: absolute;
  inset: 9px auto 9px 0;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--input-hover-border);
}
.step.queued::before, .step.running::before, .step.degraded::before, .step.skipped::before { background: var(--amber); }
.step.passed::before, .step.healthy::before { background: var(--green); }
.step.failed::before, .step.unhealthy::before { background: var(--red); }
.step strong { display: block; margin-bottom: 4px; font-size: 14px; }
.step code {
  color: var(--step-code);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}
.step-detail {
  margin-top: 6px;
  color: var(--meta-text);
  font-size: 12px;
  line-height: 1.35;
}
.step-meta { display: flex; align-items: center; justify-content: end; gap: 8px; }
.duration {
  min-width: 54px;
  color: var(--muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.empty-state {
  border: 1px dashed var(--line);
  border-radius: 8px;
  background: var(--empty-bg);
  color: var(--muted);
  padding: 20px 14px;
  font-size: 13px;
  text-align: center;
}
.empty-state.active {
  border-style: solid;
  border-color: var(--amber-border);
  background: var(--amber-soft);
  color: var(--amber);
  font-weight: 750;
}
.output-panel { min-width: 0; }
pre {
  margin: 0;
  min-height: 238px;
  max-height: 440px;
  overflow: auto;
  border: 1px solid var(--console-border);
  border-radius: 8px;
  background: var(--console-bg);
  color: var(--console-text);
  padding: 14px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.48;
  tab-size: 2;
}
pre::-webkit-scrollbar { width: 10px; height: 10px; }
pre::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 999px; border: 2px solid var(--console-bg); }
pre::-webkit-scrollbar-track { background: var(--console-bg); }
@media (max-width: 1120px) {
  .action-grid { grid-template-columns: 1fr; align-items: stretch; }
  .command-bar { grid-template-columns: repeat(3, 1fr); }
  .lower-grid { grid-template-columns: 1fr; }
}
@media (max-width: 900px) {
  .shell { padding: 20px 14px 34px; }
  .topbar { align-items: start; }
  .grid, .grid.three { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .topbar, .section-head.inline { display: block; }
  .top-meta { margin-top: 10px; }
  .command-bar { grid-template-columns: 1fr 1fr; }
  .command-button { text-align: center; }
  .auth-box { display: block; }
  .auth-controls { justify-content: start; margin-top: 10px; }
  .step { grid-template-columns: 1fr; }
  .step-meta { justify-content: start; }
  .regression-area-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  h1 { font-size: 24px; }
  .command-bar { grid-template-columns: 1fr; }
  .brand-mark { display: none; }
}
`;

export const appJs = `
const sessionTitle = document.getElementById("sessionTitle");
const sessionDetail = document.getElementById("sessionDetail");
const mfaToggle = document.getElementById("mfaToggle");
const components = document.getElementById("components");
const componentSummary = document.getElementById("componentSummary");
const browserChecks = document.getElementById("browserChecks");
const resultsRegion = document.getElementById("resultsRegion");
const jobPanel = document.getElementById("jobPanel");
const jobEyebrow = document.getElementById("jobEyebrow");
const jobTitle = document.getElementById("jobTitle");
const jobStatus = document.getElementById("jobStatus");
const output = document.getElementById("output");
const outputTitle = document.getElementById("outputTitle");
const outputMeta = document.getElementById("outputMeta");
const outputState = document.getElementById("outputState");
const summary = document.getElementById("summary");
const steps = document.getElementById("steps");
const jobMeta = document.getElementById("jobMeta");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = document.getElementById("themeLabel");
const regressionArea = document.getElementById("regressionArea");
const buttons = [...document.querySelectorAll(".command-button")];
let busy = false;
let activeButtonId = "";
let opsState = { authenticated: false, user: null, ops2faEnabled: false };
const jobCopy = {
  regression: {
    eyebrow: "API regression suite",
    title: "Regression Run",
    description: "Live execution of the TalentOS scenario regression suite.",
    outputTitle: "Regression Output",
    outputMeta: "Console output from npm.cmd run regression:<area>."
  },
  cleanup: {
    eyebrow: "Regression data cleanup",
    title: "Clean Test Data Run",
    description: "Live cleanup of records marked as regression-generated data.",
    outputTitle: "Clean Test Data Output",
    outputMeta: "Console output from npm.cmd run ops:cleanup-regression."
  },
  reset: {
    eyebrow: "Fresh local deployment",
    title: "Platform Reset",
    description: "Rebuild, migrate, seed, and verify the local TalentOS stack.",
    outputTitle: "Reset Output",
    outputMeta: "Console output from Docker, Prisma, and seed commands."
  }
};
setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);
setBusy(false);
loadOpsState();

function tickClock() {
  document.getElementById("clock").textContent = new Date().toLocaleString();
}
tickClock();
setInterval(tickClock, 1000);

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  setTheme(nextTheme, true);
});

mfaToggle.addEventListener("change", async () => {
  const enabled = mfaToggle.checked;
  mfaToggle.disabled = true;
  try {
    const result = await api("/api/ops/2fa", { method: "POST", body: JSON.stringify({ enabled }) });
    opsState.ops2faEnabled = result.ops2faEnabled;
    renderOpsState(opsState);
    setSummary("2FA setting will apply on next login.", "ok");
  } catch (error) {
    mfaToggle.checked = !enabled;
    setSummary(error.message, "error");
  } finally {
    mfaToggle.disabled = !opsState.authenticated;
  }
});

document.getElementById("healthBtn").addEventListener("click", runHealth);
document.getElementById("selectedRegressionBtn").addEventListener("click", () => startJob("regression", regressionArea.value));
document.getElementById("regressionBtn").addEventListener("click", () => startJob("regression", "all"));
document.getElementById("cleanupBtn").addEventListener("click", () => startJob("cleanup"));
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Reset deletes local TalentOS Docker volumes and reseeds demo data. Continue?")) {
    startJob("reset");
  }
});

async function loadOpsState() {
  try {
    const data = await api("/api/ops/me", { method: "GET" });
    opsState = data;
    renderOpsState(data);
  } catch (error) {
    opsState = { authenticated: false, user: null, ops2faEnabled: false };
    renderOpsState(opsState);
    setSummary(error.message, "error");
  } finally {
    setBusy(false);
  }
}

function renderOpsState(state) {
  document.body.classList.toggle("is-authenticated", state.authenticated);
  mfaToggle.checked = state.ops2faEnabled === true;
  mfaToggle.disabled = !state.authenticated;

  if (state.authenticated && state.user) {
    sessionTitle.textContent = state.user.email;
    sessionDetail.textContent = "Role " + state.user.primaryRole + " | 2FA " + (state.ops2faEnabled ? "required next login" : "not required next login");
    setSummary("Signed in with Keycloak. Ops controls are enabled.", "ok");
  } else {
    sessionTitle.textContent = "Session expired";
    sessionDetail.textContent = "Redirecting to Keycloak login.";
    setSummary("Redirecting to Keycloak login.", "warn");
    window.location.replace("/login");
    return;
  }
}

async function runHealth() {
  setBusy(true, "healthBtn");
  prepareHealthView();
  scrollToResults();
  setSummary("Running health checks across host, containers, and browser path.", "warn");
  setOutputState("checking", "running");
  try {
    const [health, browserResults] = await Promise.all([api("/api/ops/health", { method: "POST" }), runBrowserChecks()]);
    renderHealth(health);
    renderHealthResult(health, browserResults);
    output.textContent = JSON.stringify(health, null, 2);
    setOutputState(health.status, health.status);
    setSummary("Health " + health.status + " | Last checked: " + new Date(health.checkedAt).toLocaleString(), health.status === "healthy" ? "ok" : "error");
  } catch (error) {
    setSummary(error.message, "error");
    setOutputState("error", "failed");
    output.textContent = error.stack || error.message;
  } finally {
    setBusy(false);
  }
}

async function startJob(kind, area) {
  const buttonId = kind === "regression" && area !== "all" ? "selectedRegressionBtn" : kind === "regression" ? "regressionBtn" : kind === "cleanup" ? "cleanupBtn" : "resetBtn";
  prepareJobView(kind, area);
  scrollToResults();
  setBusy(true, buttonId);
  setSummary("Starting " + titleCase(kind) + " job.", "warn");
  setOutputState("queued", "queued");
  try {
    const job = await api("/api/ops/jobs", { method: "POST", body: JSON.stringify({ kind, ...(kind === "regression" ? { area: area || "all" } : {}) }) });
    pollJob(job.id);
  } catch (error) {
    setBusy(false);
    setSummary(error.message, "error");
    setOutputState("error", "failed");
    output.textContent = error.stack || error.message;
  }
}

async function pollJob(id) {
  const job = await api("/api/ops/jobs/" + encodeURIComponent(id), { method: "GET" });
  renderJob(job);
  output.textContent = job.output || JSON.stringify(job, null, 2);
  setOutputState(job.status, job.status);
  if (job.status === "running" || job.status === "queued") {
    setTimeout(() => pollJob(id).catch((error) => {
      setBusy(false);
      setSummary(error.message, "error");
      setOutputState("error", "failed");
    }), 1500);
  } else {
    setBusy(false);
    const copy = getJobCopy(job.kind);
    const regression = job.regressionSummary ? " | " + formatRegressionSummary(job.regressionSummary) : "";
    setSummary(copy.title + " " + job.status + regression + " | Run " + job.id, job.status === "passed" ? "ok" : "error");
    if (job.kind === "reset" && job.status === "passed") {
      runHealth().catch(() => {});
    }
  }
}

async function api(path, options) {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    if (response.status === 401) {
      opsState = { authenticated: false, user: null, ops2faEnabled: opsState.ops2faEnabled };
      renderOpsState(opsState);
    }
    throw new Error(data.error || "Request failed with HTTP " + response.status);
  }
  return data;
}

function renderHealth(health) {
  components.innerHTML = health.checks.map(card).join("");
  const totals = health.checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
  componentSummary.innerHTML = ["healthy", "degraded", "unhealthy"].filter((status) => totals[status]).map((status) => (
    '<span class="pill ' + status + '">' + status + " " + totals[status] + '</span>'
  )).join("");
}

function renderHealthResult(health, browserResults) {
  const totals = countStatuses(health.checks);
  const browserTotals = countStatuses(browserResults);
  const browserStatus = browserTotals.unhealthy ? "unhealthy" : browserTotals.degraded ? "degraded" : "healthy";
  jobPanel.classList.add("active");
  jobEyebrow.textContent = "System health check";
  jobTitle.textContent = "Health Check Result";
  jobStatus.textContent = health.status;
  jobStatus.className = "pill " + health.status;
  jobMeta.innerHTML = [
    '<span class="meta-chip">Checked <strong>' + new Date(health.checkedAt).toLocaleString() + '</strong></span>',
    '<span class="meta-chip">Components <strong>' + health.checks.length + '</strong></span>',
    '<span class="meta-chip">Browser checks <strong>' + browserResults.length + '</strong></span>'
  ].join(" ");
  steps.innerHTML = [
    healthResultStep({
      title: "Container and service health",
      status: health.status,
      detail: formatStatusTotals(totals, health.checks.length),
      command: "Docker, Compose, PostgreSQL, Keycloak, MinIO, Applicant, and Admin reachability"
    }),
    healthResultStep({
      title: "Browser client path",
      status: browserStatus,
      detail: formatStatusTotals(browserTotals, browserResults.length),
      command: "Browser-origin checks for localhost Applicant, Admin, and Keycloak URLs"
    }),
    healthResultStep({
      title: "Raw response captured",
      status: health.status,
      detail: "Full JSON response is available in the output panel.",
      command: "POST /api/ops/health"
    })
  ].join("");
  outputTitle.textContent = "Health Check Output";
  outputMeta.textContent = "Raw health check response from the local Ops API.";
}

function card(check) {
  const label = check.status === "healthy" ? "OK" : check.status.toUpperCase();
  const duration = typeof check.durationMs === "number" ? '<span class="metric">' + check.durationMs + "ms</span> " : "";
  return '<article class="card ' + check.status + '"><div class="card-head"><h3>' + escapeHtml(check.name) + '</h3><span class="pill ' + check.status + '">' + label + '</span></div><p class="card-detail">' + duration + escapeHtml(check.detail) + '</p></article>';
}

async function runBrowserChecks() {
  const checks = [
    ["Browser to Applicant Portal", "http://localhost:3100"],
    ["Browser to Admin Portal", "http://localhost:3200"],
    ["Browser to Keycloak issuer", "http://keycloak.lvh.me:8080/realms/talentos/.well-known/openid-configuration"]
  ];
  const results = [];
  for (const [name, url] of checks) {
    const started = performance.now();
    try {
      await fetch(url, { mode: "no-cors", cache: "no-store" });
      results.push({ name, status: "healthy", detail: "Browser reached " + url, durationMs: Math.round(performance.now() - started) });
    } catch (error) {
      results.push({ name, status: "unhealthy", detail: url + ": " + error.message, durationMs: Math.round(performance.now() - started) });
    }
  }
  browserChecks.innerHTML = results.map(card).join("");
  return results;
}

function renderJob(job) {
  const copy = getJobCopy(job.kind);
  jobPanel.classList.add("active");
  jobEyebrow.textContent = copy.eyebrow;
  jobTitle.textContent = copy.title;
  outputTitle.textContent = copy.outputTitle;
  outputMeta.textContent = copy.outputMeta;
  jobStatus.textContent = job.status;
  jobStatus.className = "pill " + job.status;
  jobMeta.innerHTML = [
    '<span class="meta-chip">Run <strong>' + escapeHtml(shortRunId(job.id)) + '</strong></span>',
    job.kind === "regression" ? '<span class="meta-chip">Area <strong>' + escapeHtml(job.area || "all") + '</strong></span>' : "",
    job.regressionSummary ? '<span class="meta-chip">Passed <strong>' + job.regressionSummary.passed + "/" + job.regressionSummary.total + '</strong></span>' : "",
    job.regressionSummary ? '<span class="meta-chip">Failed <strong>' + job.regressionSummary.failed + '</strong></span>' : "",
    job.regressionSummary ? '<span class="meta-chip">Skipped <strong>' + job.regressionSummary.skipped + '</strong></span>' : "",
    '<span class="meta-chip">Started <strong>' + new Date(job.startedAt).toLocaleString() + '</strong></span>',
    job.completedAt ? '<span class="meta-chip">Completed <strong>' + new Date(job.completedAt).toLocaleString() + '</strong></span>' : '<span class="meta-chip">Status <strong>' + escapeHtml(job.status) + '</strong></span>'
  ].filter(Boolean).join(" ");
  steps.innerHTML = job.kind === "regression" && Array.isArray(job.regressionScenarios) && job.regressionScenarios.length
    ? renderRegressionScenarioGroups(job.regressionScenarios, job.regressionSummaries || [])
    : job.kind === "regression" && Array.isArray(job.regressionSummaries) && job.regressionSummaries.length
    ? renderRegressionAreaCards(job.regressionSummaries)
    : job.steps.map((step) => (
      '<div class="step ' + step.status + '"><div><strong>' + escapeHtml(step.name) + '</strong><code>' + escapeHtml(step.command) + '</code>' + (step.regressionSummary ? '<p class="step-detail">' + escapeHtml(formatRegressionSummary(step.regressionSummary)) + '</p>' : '') + '</div><div class="step-meta"><span class="pill ' + step.status + '">' + step.status + '</span><span class="duration">' + (step.durationMs ? formatDuration(step.durationMs) : "") + '</span></div></div>'
    )).join("");
}

function renderRegressionAreaCards(summaries) {
  return '<div class="regression-area-grid">' + summaries.map((area) => {
    const status = area.failed > 0 ? "failed" : "passed";
    return '<article class="card regression-area-card ' + status + '">'
      + '<div class="card-head"><h3>' + escapeHtml(titleCase(area.area)) + '</h3><span class="pill ' + status + '">' + status + '</span></div>'
      + '<div class="card-detail">'
      + '<div class="regression-counts">'
      + '<span class="regression-count">Passed ' + area.passed + '</span>'
      + '<span class="regression-count failed">Failed ' + area.failed + '</span>'
      + '<span class="regression-count skipped">Skipped ' + area.skipped + '</span>'
      + '</div>'
      + '<span class="metric">' + escapeHtml(formatDuration(area.durationMs)) + '</span>'
      + '</div>'
      + '</article>';
  }).join("") + '</div>';
}

function renderRegressionScenarioGroups(scenarios, summaries) {
  const order = ["unit", "auth", "applicant", "admin", "programs", "missions", "journal", "tenant", "dashboard", "storage", "ops"];
  const summaryByArea = new Map((summaries || []).map((summary) => [summary.area, summary]));
  const grouped = new Map();
  scenarios.forEach((scenario) => {
    if (!grouped.has(scenario.area)) grouped.set(scenario.area, []);
    grouped.get(scenario.area).push(scenario);
  });
  const areas = [...grouped.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  return '<div class="regression-area-grid">' + areas.map((areaName) => {
    const areaScenarios = grouped.get(areaName);
    const summary = summaryByArea.get(areaName) || summarizeScenarios(areaName, areaScenarios);
    const status = summary.failed > 0 ? "failed" : "passed";
    return '<article class="card regression-area-card ' + status + '">'
      + '<div class="card-head"><h3>' + escapeHtml(titleCase(areaName)) + '</h3><span class="pill ' + status + '">' + status + '</span></div>'
      + '<div class="card-detail">'
      + '<div class="regression-counts">'
      + '<span class="regression-count">Passed ' + summary.passed + '</span>'
      + '<span class="regression-count failed">Failed ' + summary.failed + '</span>'
      + '<span class="regression-count skipped">Skipped ' + summary.skipped + '</span>'
      + '</div>'
      + '<span class="metric">' + escapeHtml(formatDuration(summary.durationMs)) + '</span>'
      + '<div class="regression-scenario-list">'
      + areaScenarios.map(renderRegressionScenarioRow).join("")
      + '</div>'
      + '</div>'
      + '</article>';
  }).join("") + '</div>';
}

function renderRegressionScenarioRow(scenario) {
  const message = scenario.error || scenario.detail || "";
  const messageClass = scenario.error ? " regression-scenario-error" : "";
  return '<div class="regression-scenario-row ' + escapeHtml(scenario.status) + '">'
    + '<div>'
    + '<div class="regression-scenario-name">' + escapeHtml(scenario.name) + '</div>'
    + (message ? '<div class="regression-scenario-detail' + messageClass + '">' + escapeHtml(message) + '</div>' : '')
    + '</div>'
    + '<div class="step-meta"><span class="pill ' + escapeHtml(scenario.status) + '">' + escapeHtml(scenario.status) + '</span><span class="duration">' + escapeHtml(formatDuration(scenario.durationMs)) + '</span></div>'
    + '</div>';
}

function summarizeScenarios(area, scenarios) {
  return scenarios.reduce((summary, scenario) => ({
    area,
    total: summary.total + 1,
    passed: summary.passed + (scenario.status === "passed" ? 1 : 0),
    failed: summary.failed + (scenario.status === "failed" ? 1 : 0),
    skipped: summary.skipped + (scenario.status === "skipped" ? 1 : 0),
    durationMs: summary.durationMs + (typeof scenario.durationMs === "number" ? scenario.durationMs : 0)
  }), { area, total: 0, passed: 0, failed: 0, skipped: 0, durationMs: 0 });
}

function healthResultStep({ title, status, detail, command }) {
  const label = status === "healthy" ? "OK" : status === "passed" ? "passed" : status;
  return '<div class="step ' + status + '"><div><strong>' + escapeHtml(title) + '</strong><code>' + escapeHtml(command) + '</code><p class="step-detail">' + escapeHtml(detail) + '</p></div><div class="step-meta"><span class="pill ' + status + '">' + escapeHtml(label) + '</span></div></div>';
}

function prepareJobView(kind, area) {
  const copy = getJobCopy(kind);
  jobPanel.classList.add("active");
  jobEyebrow.textContent = copy.eyebrow;
  jobTitle.textContent = copy.title;
  jobMeta.innerHTML = '<span class="meta-chip">Preparing <strong>' + escapeHtml(copy.title) + '</strong></span>' + (kind === "regression" ? '<span class="meta-chip">Area <strong>' + escapeHtml(area || "all") + '</strong></span>' : '');
  jobStatus.textContent = "queued";
  jobStatus.className = "pill queued";
  outputTitle.textContent = copy.outputTitle;
  outputMeta.textContent = copy.outputMeta;
  output.textContent = "{}";
  steps.innerHTML = '<div class="empty-state active">' + escapeHtml(copy.description) + ' Waiting for the first job update...</div>';
}

function formatRegressionSummary(summary) {
  return summary.passed + "/" + summary.total + " passed, " + summary.failed + " failed, " + summary.skipped + " skipped";
}

function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return "";
  if (ms < 1000) return Math.round(ms) + "ms";
  const seconds = ms / 1000;
  if (seconds < 60) return seconds.toFixed(seconds < 10 ? 1 : 0) + "s";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return minutes + "m " + remainingSeconds + "s";
}

function prepareHealthView() {
  jobPanel.classList.add("active");
  jobEyebrow.textContent = "System health check";
  jobTitle.textContent = "Health Check Result";
  jobMeta.innerHTML = '<span class="meta-chip">Preparing <strong>Health Check</strong></span>';
  jobStatus.textContent = "running";
  jobStatus.className = "pill running";
  outputTitle.textContent = "Health Check Output";
  outputMeta.textContent = "Raw health check response from the local Ops API.";
  output.textContent = "{}";
  steps.innerHTML = '<div class="empty-state active">Checking Docker, containers, database, services, and browser client path...</div>';
}

function countStatuses(checks) {
  return checks.reduce((acc, check) => {
    acc[check.status] = (acc[check.status] || 0) + 1;
    return acc;
  }, {});
}

function formatStatusTotals(totals, total) {
  const parts = ["healthy", "degraded", "unhealthy"].filter((status) => totals[status]).map((status) => totals[status] + " " + status);
  return (parts.length ? parts.join(", ") : "0 checks") + " across " + total + " checks.";
}

function scrollToResults() {
  window.requestAnimationFrame(() => {
    resultsRegion.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function getJobCopy(kind) {
  return jobCopy[kind] || {
    eyebrow: "Operation run",
    title: "Operation Results",
    description: "Live operation progress.",
    outputTitle: "Execution Output",
    outputMeta: "Raw job logs and API responses."
  };
}

function shortRunId(id) {
  return String(id).slice(0, 8);
}

function setBusy(value, activeId) {
  busy = value;
  activeButtonId = value ? activeId || "" : "";
  buttons.forEach((button) => {
    button.disabled = value || !opsState.authenticated;
    button.classList.toggle("is-active", value && button.id === activeButtonId);
  });
  regressionArea.disabled = value || !opsState.authenticated;
}

function setSummary(message, tone) {
  summary.textContent = message;
  summary.className = "notice " + (tone || "info");
}

function setOutputState(label, status) {
  outputState.textContent = label;
  outputState.className = "pill " + (status || "neutral");
}

function setTheme(theme, persist) {
  document.documentElement.dataset.theme = theme;
  themeLabel.textContent = theme === "dark" ? "Light" : "Dark";
  themeToggle.setAttribute("aria-label", "Switch to " + (theme === "dark" ? "light" : "dark") + " mode");
  themeToggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  if (persist) {
    try {
      localStorage.setItem("opsTheme", theme);
    } catch {
      // Theme still applies for the current page when browser storage is unavailable.
    }
  }
}

function titleCase(value) {
  return String(value).slice(0, 1).toUpperCase() + String(value).slice(1);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}
`;
