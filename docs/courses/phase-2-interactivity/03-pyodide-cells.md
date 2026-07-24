# P2-03 — Pyodide worker + runnable code cells

**Tag:** `COURSE-P2-03` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Runnable Python in the browser via **Pyodide in a Web Worker**. Students edit and execute NumPy
code inside the lesson — zero server cost, works on Hobby forever. The worker is mandatory, not
an optimisation: it is the only way a student's `while True:` doesn't freeze their tab.

## Context

- **PyTorch does not run in Pyodide. NumPy does.** Blocks 0–3 are "implement it from scratch in
  NumPy", which is both the pedagogically right choice for a rigour-focused course and the only
  thing that runs client-side. Block 4's fine-tuning goes to Colab (`<ColabLink>` from P1-01).
- The CSP already permits `'wasm-unsafe-eval'`, `'unsafe-eval'`, `worker-src 'self' blob:` and
  `child-src 'self' blob:` — all present for the Zoom SDK (`next.config.mjs`). **The WASM/worker
  fight is already won**; only the CDN origin needs adding.
- `hasCode` in the lesson frontmatter (P1-02) exists precisely so the reader knows whether to
  prepare for this at all.

## Files affected

| File | Change |
|------|--------|
| `next.config.mjs` | + `https://cdn.jsdelivr.net` to `script-src`, `connect-src`, `worker-src` (both dev and prod arrays) |
| `src/lib/courses/pyodide/worker.ts` (new) | The worker: load Pyodide, load packages, run, capture stdout/stderr |
| `src/lib/courses/pyodide/client.ts` (new) | Main-thread client: spawn, message protocol, timeout + terminate, lifecycle |
| `src/features/courses/code/PyCell.tsx` (new) | Editor + Run/Reset + output panel |
| `src/features/courses/code/CodeOutput.tsx` (new) | stdout / stderr / traceback rendering |
| `src/lib/courses/mdx-components.tsx` | + `PyCell` |
| `scripts/check-bundle.ts` | + assert Pyodide is absent from every chunk except its lazy one |

## The change

**Loading strategy — three gates, all required:**

1. Only on lessons with `hasCode: true`
2. Only after the **first Run click** (never on mount, never on hover)
3. Only the packages a cell declares (`packages={["numpy"]}`)

The worker is created once per page and reused across cells on that lesson.

**Message protocol** — keep it explicit and typed:

```
main → worker : { type: "init", packages }
              | { type: "run", id, code }
              | { type: "reset" }
worker → main : { type: "ready" }
              | { type: "stdout" | "stderr", id, text }   // streamed
              | { type: "result", id, ok, error? }
              | { type: "loading", stage, pct }
```

**Timeout and termination — the safety-critical part.** Pyodide is single-threaded and cannot be
interrupted cooperatively; an infinite loop is only stoppable by killing the worker.

- Hard timeout per run (start at 10s; a from-scratch MLP training loop on toy data fits easily)
- On timeout: `worker.terminate()`, show "la ejecución superó los 10 s y se detuvo", offer restart
- Restart lazily on the next Run — do not eagerly reload the 10 MB

**Streamed output.** Redirect Python's `stdout`/`stderr` to post messages as they're written, so
a training loop prints per-epoch loss live instead of dumping everything at the end. This matters
a lot for perceived responsiveness and for teaching — watching loss fall *is* the lesson.

**Editor.** Start with a styled `<textarea>` plus tab-to-indent, bracket matching, and the Shiki
render shown when not focused. **Do not add CodeMirror or Monaco in this task** — Monaco is
~2 MB and would dwarf the widgets. Revisit only if authoring the content proves the textarea
inadequate.

**`matplotlib` is excluded.** The wheel is ~15 MB. Return arrays from Python and plot them with
the P2-01 SVG primitives — better looking, consistent with the design, and a fraction of the size.
Provide a documented `plot(xs, ys)` helper in the cell preamble that emits a structured message
the React side renders.

**CDN vs. self-hosting.** Start with jsDelivr: ~20 MB stays out of the repo and off the 100 GB
Hobby bandwidth budget, and the browser caches it across lessons and across visits. The cost is
a third-party origin in the CSP and a dependency on jsDelivr's uptime. Pin the exact Pyodide
version in the URL. If that trade ever sours, self-hosting under `public/pyodide/` is a
config change plus a CSP tightening — note this explicitly in the file-top comment.

## Acceptance criteria

- [ ] A NumPy snippet runs and prints; `import numpy` succeeds
- [ ] Nothing Pyodide-related loads before the first Run click (verify in the network panel)
- [ ] No Pyodide request at all on a lesson with `hasCode: false`
- [ ] `while True: pass` is terminated at the timeout; **the tab stays responsive throughout**
- [ ] After a timeout, the next Run restarts the worker and succeeds
- [ ] A Python exception shows a readable traceback, not a blank panel
- [ ] `print()` inside a loop streams incrementally
- [ ] Loading shows real progress (packages are large; a spinner with no progress reads as broken)
- [ ] Reset restores the cell's original code
- [ ] Two cells on one lesson share a worker and share module-level state in author-intended order
- [ ] **Zero CSP violations in the console** in production build
- [ ] Bundle guard green
- [ ] Works on mobile Safari and Chrome Android (verify on a real device — WASM memory limits differ)
- [ ] `pnpm build` green

## Test plan

- **Unit:** the client's message protocol and timeout logic against a mocked worker — timeout
  fires terminate; late messages from a terminated worker are ignored; restart works.
- **Manual (essential, cannot be automated meaningfully):** the acceptance list above, run in a
  production build (`pnpm build && pnpm start`) — CSP differs between dev and prod.
- **Mobile:** a real iOS device. Pyodide's memory footprint is the most likely place this breaks,
  and mobile Safari is the least forgiving environment.
- **E2E:** one Playwright test that loads a code lesson and asserts no Pyodide network request
  before clicking Run. Don't E2E the execution itself — too slow, too flaky.

## Notes / gotchas

- **Pin the Pyodide version in the CDN URL.** An unpinned `latest` will break the course silently
  one day, on a page you aren't watching.
- Add the CDN origin to **both** the dev and prod CSP arrays in `next.config.mjs`. They're
  separate lists; changing only one produces "works in dev, broken in prod".
- `worker-src` needs the CDN too, not just `script-src` — Pyodide spawns its own internals.
- Warn in the loading UI that the first run downloads several MB. On a phone with mobile data,
  silently pulling 17 MB is a genuinely hostile thing to do.
- Do not run any student code on the server. Ever. There is no server-side execution path in this
  plan and there should never be one.
- Streamed stdout can flood the main thread on a tight print loop — batch messages on a short
  interval and cap retained output lines.
- Keep cells small in content. A 200-line cell is a sign the lesson should be split.

## Out of scope

- Code challenges with hidden assertions (P3-02) — built on this worker.
- A full editor (CodeMirror/Monaco).
- `matplotlib`, `pandas`, `scikit-learn`, PyTorch.
- Persisting student-edited code (would need a DB table; not in this plan).
