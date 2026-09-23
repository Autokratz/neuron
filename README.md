# NEURON — learn AI engineering as a skill-tree RPG

**52 graded coding quests that execute and test real Python in the browser — no server, no account, no build step.** Python runs through Pyodide compiled to WebAssembly, and every quest is graded by a hidden `assert`-based test suite against your actual submission, not by string matching. Roughly 900 lines of vanilla JavaScript, HTML and CSS.

---


Build real code → grade with real Python (in-browser) → earn XP → unlock the next node.
No backend. Python runs via Pyodide (WASM). Progress saved in localStorage.

## Run
Pyodide loads cleanest over http (not file://). From this folder:

```bash
python3 -m http.server 8000
```
Open http://localhost:8000  (needs internet first load — pulls Pyodide from CDN, then caches).

## Play
- Click a glowing node → read brief → write code → **Run** (see output) → **Submit & Grade**.
- Pass all hidden tests = quest cleared, XP, next node unlocks.
- Clear `py-4` then beat **BOSS: Prompt Engine** to finish Region 1 (Python Isle).

## How it works
- `quests.js` — all content. A quest = brief + starter + hidden `tests` (real `assert`s).
- `app.js` — engine: unlock DAG, XP/level/streak, Pyodide grader (`_grade` / `_capture`).
- `style.css` — neon UI. `index.html` — shell.

## Add content (this is the curriculum engine)
Append a node to `window.QUESTS`:
```js
{ id:"ml-1", region:"ml-forest", title:"Gradient Descent", type:"lesson",
  x:120, y:90, requires:["py-boss"], xp:200,
  brief:"...", starter:"def step(...):\n    pass\n",
  tests:[ {name:"converges", code:"assert abs(step(...)-0.0)<1e-3"} ] }
```
New region = add to `window.REGIONS` + give nodes that `region` id and map coords.

## Regions — ALL 8 BUILT ✅ (43 quests)
Scroll the map top→bottom. Each region gated behind the previous boss.
Designed for **zero-experience start** — first two regions teach Python from scratch.

1. **Python Isle** (from zero) — variable/return, arithmetic, strings, f-strings, if/else, loops, BOSS FizzBuzz
2. **Data Dunes** — lists, build-a-list, word tally, dict lookup, Cart OOP, BOSS prompt template
3. **Prompt Peaks** — chat messages, few-shot, token budget, stream stop-token, BOSS stateful Chat
4. **Math Caverns** — dot, matmul, sigmoid/softmax, MSE, BOSS gradient descent step
5. **ML Forest** — train/test split, accuracy, kNN, normalize, BOSS k-means step
6. **RAG Valley** — cosine, bag-of-words embed, chunking, top-k, BOSS full retrieve pipeline
7. **Agent Wastes** — tool dispatch, parse action (regex), backoff, ReAct loop, BOSS routing agent
8. **Deploy Citadel** — rate limiter, retry, cache, eval harness, FINAL BOSS guardrail pipeline

Every quest verified solvable (43/43 graded green against reference solutions).

## Hints
Every quest has 2-3 **progressive hints** (`hints:` array). Click **💡 Hint** to reveal one at a time —
early hints nudge, last hint shows near-complete code. A failed Submit nudges you toward the hint.
Beginner quests have the most generous hints.

### Backlog ideas
- LLM-judge grading (Claude) for open-ended quests + "explain it back" teach-back NPC.
- Auto-push boss artifacts to GitHub = résumé builds while you play.
- Adaptive hints after 2 fails (just-in-time micro-lessons).
