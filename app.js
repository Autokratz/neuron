// NEURON — game engine. Pyodide grades real Python in-browser. No backend.

const LS_KEY = "neuron_state_v1";
let pyodide = null;
let activeQuest = null;
let hintIdx = 0;

// ---------- state ----------
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; }
}
function defaultState() {
  return { completed: [], xp: 0, streak: 0, lastDay: null, code: {} };
}
let state = Object.assign(defaultState(), loadState());
function save() { localStorage.setItem(LS_KEY, JSON.stringify(state)); }

function levelFor(xp) { return Math.floor(Math.sqrt(xp / 100)) + 1; }
function xpForLevel(lvl) { return Math.pow(lvl - 1, 2) * 100; }

function todayStr() { return new Date().toISOString().slice(0, 10); }
function bumpStreak() {
  const t = todayStr();
  if (state.lastDay === t) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  state.streak = state.lastDay === y ? state.streak + 1 : 1;
  state.lastDay = t;
}

// ---------- unlock logic ----------
function statusOf(q) {
  if (state.completed.includes(q.id)) return "done";
  const ready = q.requires.every((r) => state.completed.includes(r));
  return ready ? "available" : "locked";
}

// ---------- render map ----------
function renderHUD() {
  const lvl = levelFor(state.xp);
  const cur = state.xp - xpForLevel(lvl);
  const span = xpForLevel(lvl + 1) - xpForLevel(lvl);
  document.getElementById("lvl").textContent = lvl;
  document.getElementById("xpnum").textContent = state.xp;
  document.getElementById("streak").textContent = state.streak;
  document.getElementById("xpfill").style.width = Math.min(100, (cur / span) * 100) + "%";
}

function renderTree() {
  const tree = document.getElementById("tree");
  const edges = document.getElementById("edges");
  tree.querySelectorAll(".node, .band").forEach((n) => n.remove());
  edges.innerHTML = "";

  // size the canvas to fit every region band
  const CANVAS_H = (REGIONS[REGIONS.length - 1].bandTop) + 280;
  tree.style.height = CANVAS_H + "px";
  edges.setAttribute("height", CANVAS_H);
  edges.style.height = CANVAS_H + "px";

  // region band headers + progress
  REGIONS.forEach((reg, i) => {
    const qs = QUESTS.filter((q) => q.region === reg.id);
    const done = qs.filter((q) => state.completed.includes(q.id)).length;
    const unlocked = qs.some((q) => statusOf(q) !== "locked");
    const band = document.createElement("div");
    band.className = "band" + (done === qs.length ? " cleared" : "");
    band.style.top = reg.bandTop + "px";
    band.innerHTML =
      `<div class="bname">REGION ${i + 1} · ${reg.name} ${done === qs.length ? "✅" : unlocked ? "" : "🔒"}</div>` +
      `<div class="bblurb">${reg.blurb}</div>` +
      `<div class="bprog">${done}/${qs.length} cleared</div>`;
    tree.appendChild(band);
  });

  // edges first
  QUESTS.forEach((q) => {
    q.requires.forEach((rid) => {
      const from = QUESTS.find((x) => x.id === rid);
      if (!from) return;
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", from.x); ln.setAttribute("y1", from.y);
      ln.setAttribute("x2", q.x); ln.setAttribute("y2", q.y);
      if (state.completed.includes(rid)) ln.classList.add("lit");
      edges.appendChild(ln);
    });
  });

  QUESTS.forEach((q) => {
    const st = statusOf(q);
    const el = document.createElement("div");
    el.className = `node ${st}` + (q.type === "boss" ? " boss" : "");
    el.style.left = q.x + "px"; el.style.top = q.y + "px";
    const icon = q.type === "boss" ? "👹" : st === "done" ? "✔" : st === "locked" ? "🔒" : "◆";
    el.innerHTML = `<div class="orb">${icon}</div>
      <div class="title">${q.title}</div>
      <div class="xp">+${q.xp} XP</div>`;
    el.onclick = () => { if (st !== "locked") openQuest(q); };
    tree.appendChild(el);
  });
}

// ---------- quest panel ----------
function openQuest(q) {
  activeQuest = q;
  hintIdx = 0;
  const panel = document.getElementById("quest");
  panel.classList.add("open");
  document.getElementById("qtitle").textContent = q.title;
  const badge = document.getElementById("qbadge");
  badge.textContent = q.type === "boss" ? "BOSS" : "LESSON";
  badge.className = "badge " + q.type;
  document.getElementById("qbrief").textContent = q.brief;
  document.getElementById("editor").value = state.code[q.id] || q.starter;
  document.getElementById("hints").innerHTML = "";
  document.getElementById("output").innerHTML =
    statusOf(q) === "done" ? '<div class="banner win">CLEARED ✔ — replay anytime</div>' : "";
  renderHintBtn();
}

function renderHintBtn() {
  const btn = document.getElementById("btnHint");
  const hints = (activeQuest && activeQuest.hints) || [];
  const left = hints.length - hintIdx;
  if (left > 0) { btn.disabled = false; btn.textContent = `💡 Hint (${left})`; }
  else { btn.disabled = true; btn.textContent = "💡 No more hints"; }
}

function showHint() {
  const hints = (activeQuest && activeQuest.hints) || [];
  if (hintIdx >= hints.length) return;
  const box = document.getElementById("hints");
  const h = document.createElement("div");
  h.className = "hintbox";
  h.innerHTML = `<b>Hint ${hintIdx + 1}:</b> <pre>${esc(hints[hintIdx])}</pre>`;
  box.appendChild(h);
  hintIdx++;
  renderHintBtn();
}
function closeQuest() {
  document.getElementById("quest").classList.remove("open");
  activeQuest = null;
}

function setBusy(b) {
  document.getElementById("btnRun").disabled = b;
  document.getElementById("btnSubmit").disabled = b;
}

// ---------- python execution ----------
async function runCode() {
  if (!activeQuest || !pyodide) return;
  const code = document.getElementById("editor").value;
  state.code[activeQuest.id] = code; save();
  const out = document.getElementById("output");
  out.innerHTML = '<span class="muted">running…</span>';
  setBusy(true);
  pyodide.globals.set("USER_CODE", code);
  let res;
  try {
    res = await pyodide.runPythonAsync(`_capture(USER_CODE)`);
  } catch (e) {
    out.innerHTML = `<div class="banner lose">runtime error</div><pre>${esc(String(e))}</pre>`;
    setBusy(false); return;
  }
  const r = JSON.parse(res);
  out.innerHTML =
    (r.err ? `<div class="banner lose">error</div>` : `<div class="muted">output:</div>`) +
    `<pre>${esc(r.out || "(no output)") }${r.err ? "\n" + esc(r.err) : ""}</pre>`;
  setBusy(false);
}

async function submitCode() {
  if (!activeQuest || !pyodide) return;
  const q = activeQuest;
  const code = document.getElementById("editor").value;
  state.code[q.id] = code; save();
  const out = document.getElementById("output");
  out.innerHTML = '<span class="muted">grading…</span>';
  setBusy(true);
  pyodide.globals.set("USER_CODE", code);
  pyodide.globals.set("TESTS_JSON", JSON.stringify(q.tests));
  let res;
  try {
    res = await pyodide.runPythonAsync(`_grade(USER_CODE, TESTS_JSON)`);
  } catch (e) {
    out.innerHTML = `<div class="banner lose">grader crashed</div><pre>${esc(String(e))}</pre>`;
    setBusy(false); return;
  }
  const results = JSON.parse(res);
  const passed = results.every((t) => t.ok);
  let html = results.map((t) =>
    `<div class="test ${t.ok ? "pass" : "fail"}">${t.ok ? "✔" : "✗"} ${esc(t.name)}${t.err ? " — " + esc(t.err) : ""}</div>`
  ).join("");

  if (passed) {
    const firstClear = !state.completed.includes(q.id);
    html = `<div class="banner win">${q.type === "boss" ? "BOSS DOWN — REGION CLEARED!" : "QUEST CLEARED!"} ${firstClear ? "+" + q.xp + " XP" : "(already cleared)"}</div>` + html;
    if (firstClear) awardXP(q);
  } else {
    const nleft = (q.hints || []).length - hintIdx;
    const nudge = nleft > 0 ? " — stuck? tap 💡 Hint" : "";
    html = `<div class="banner lose">${results.filter(t=>!t.ok).length} test(s) failing — fix and resubmit${nudge}</div>` + html;
  }
  out.innerHTML = html;
  setBusy(false);
}

function awardXP(q) {
  const before = levelFor(state.xp);
  state.completed.push(q.id);
  state.xp += q.xp;
  bumpStreak();
  save();
  const after = levelFor(state.xp);
  renderHUD(); renderTree();
  if (state.completed.length === QUESTS.length) {
    setTimeout(() => toast("🏆 NEURON CLEARED — YOU'RE AN AI ENGINEER"), 600);
  } else if (q.type === "boss") {
    toast("👑 REGION CLEARED — new region unlocked!");
  } else if (after > before) {
    toast(`⚡ LEVEL UP → ${after}`);
  }
}

// ---------- fx ----------
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2600);
}
function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

// tab support in editor
function editorKeys(e) {
  if (e.key === "Tab") {
    e.preventDefault();
    const ta = e.target, s = ta.selectionStart, en = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + "    " + ta.value.slice(en);
    ta.selectionStart = ta.selectionEnd = s + 4;
  }
}

// ---------- boot ----------
const PY_HARNESS = `
import json, io, contextlib, traceback

def _capture(user_code):
    buf = io.StringIO()
    err = ""
    try:
        with contextlib.redirect_stdout(buf):
            exec(user_code, {})
    except Exception:
        err = traceback.format_exc()
    return json.dumps({"out": buf.getvalue(), "err": err})

def _grade(user_code, tests_json):
    tests = json.loads(tests_json)
    ns = {}
    try:
        exec(user_code, ns)
    except Exception as e:
        return json.dumps([{"name": "your code runs", "ok": False, "err": str(e)}])
    results = []
    for t in tests:
        scope = dict(ns)
        try:
            exec(t["code"], scope)
            results.append({"name": t["name"], "ok": True, "err": ""})
        except AssertionError as e:
            results.append({"name": t["name"], "ok": False, "err": str(e) or "wrong result"})
        except Exception as e:
            results.append({"name": t["name"], "ok": False, "err": type(e).__name__ + ": " + str(e)})
    return json.dumps(results)
`;

async function boot() {
  document.getElementById("bootsub").textContent = "loading Python runtime (WASM)…";
  pyodide = await loadPyodide();
  await pyodide.runPythonAsync(PY_HARNESS);
  document.getElementById("boot").style.display = "none";
  renderHUD(); renderTree();
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnRun").onclick = runCode;
  document.getElementById("btnSubmit").onclick = submitCode;
  document.getElementById("btnHint").onclick = showHint;
  document.getElementById("btnClose").onclick = closeQuest;
  document.getElementById("btnReset").onclick = () => {
    if (confirm("Reset all progress?")) { state = defaultState(); save(); renderHUD(); renderTree(); closeQuest(); }
  };
  document.getElementById("editor").addEventListener("keydown", editorKeys);
  boot();
});
