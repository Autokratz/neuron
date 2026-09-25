// Validates the quest graph without a browser. The content model is data, so
// a broken prerequisite or a duplicate id is a data bug, and data bugs are
// exactly what a reader never notices until a learner is stuck.
import { readFileSync } from "node:fs";
import vm from "node:vm";

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(readFileSync("quests.js", "utf8"), sandbox);

const { REGIONS, QUESTS } = sandbox.window;
const problems = [];
const fail = (m) => problems.push(m);

if (!Array.isArray(REGIONS) || !REGIONS.length) fail("REGIONS missing or empty");
if (!Array.isArray(QUESTS) || !QUESTS.length) fail("QUESTS missing or empty");

const regionIds = new Set(REGIONS.map((r) => r.id));
const questIds = new Set();

for (const q of QUESTS) {
  const at = q.id ? `quest ${q.id}` : `quest "${q.title ?? "<untitled>"}"`;

  for (const field of ["id", "region", "title", "brief", "starter", "tests"]) {
    if (q[field] === undefined) fail(`${at}: missing ${field}`);
  }
  if (questIds.has(q.id)) fail(`${at}: duplicate id`);
  questIds.add(q.id);

  if (q.region && !regionIds.has(q.region)) fail(`${at}: unknown region "${q.region}"`);
  if (Array.isArray(q.tests) && q.tests.length === 0) fail(`${at}: no tests, so it cannot be graded`);
  for (const t of q.tests ?? []) {
    if (!t.name || !t.code) fail(`${at}: a test is missing name or code`);
    // A test grades either by asserting, or by proving a call raises, which
    // is written as try / raise AssertionError / except.
    if (t.code && !/\bassert\b|AssertionError/.test(t.code)) {
      fail(`${at}: test "${t.name}" neither asserts nor checks for a raise`);
    }
  }
  if (typeof q.xp !== "number" || q.xp <= 0) fail(`${at}: xp must be a positive number`);
}

// every prerequisite must exist, or the node is permanently unreachable
for (const q of QUESTS) {
  for (const need of q.requires ?? []) {
    if (!questIds.has(need)) fail(`quest ${q.id}: requires "${need}", which does not exist`);
  }
}

// and the graph must be acyclic, or a cycle locks every quest in it forever
const byId = new Map(QUESTS.map((q) => [q.id, q]));
const state = new Map();
const walk = (id, trail) => {
  if (state.get(id) === "done") return;
  if (state.get(id) === "open") {
    fail(`dependency cycle: ${[...trail, id].join(" -> ")}`);
    return;
  }
  state.set(id, "open");
  for (const need of byId.get(id)?.requires ?? []) walk(need, [...trail, id]);
  state.set(id, "done");
};
for (const q of QUESTS) walk(q.id, []);

// at least one quest must need nothing, or nothing can ever be started
if (!QUESTS.some((q) => !(q.requires ?? []).length)) fail("no quest is reachable at the start");

console.log(`regions: ${REGIONS.length}  quests: ${QUESTS.length}`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log("quest graph is valid");
