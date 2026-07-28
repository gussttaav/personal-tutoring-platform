/*
 * COURSE-P2-03 — The one module that touches the real `Worker` API.
 *
 * It is separate from `client.ts` on purpose. `new URL("./worker.ts", import.meta.url)`
 * is how the bundler is told to emit the worker as its own asset, but `import.meta`
 * does not survive Jest's CJS transform and the unit projects run in the `node`
 * environment with no `Worker` at all. Keeping it here leaves `PyodideClient` — the
 * part with the timeout and termination logic worth testing — importable from a test.
 *
 * This module is reached ONLY through a dynamic `import()` inside a Run click
 * handler, which is what keeps Pyodide out of every first-load bundle
 * (`scripts/check-bundle.ts` enforces that, lesson route included).
 *
 * The client is a per-document singleton so every cell on a lesson shares one
 * interpreter — which is the point: cell 2 can use what cell 1 defined. Cells
 * register/release so the worker is terminated when the last one unmounts; without
 * that, client-side navigation to another lesson would leave a ~15 MB interpreter
 * resident for the rest of the session.
 */

import { PyodideClient, type WorkerLike } from "./client";

let client: PyodideClient | null = null;
let cellCount = 0;

function spawnWorker(): WorkerLike {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "pycell",
  }) as unknown as WorkerLike;
}

/** The shared interpreter for this document, created on first use. */
export function getPyodideClient(): PyodideClient {
  if (!client) client = new PyodideClient(spawnWorker);
  return client;
}

/** Call on mount. Returns the matching release function for the unmount cleanup. */
export function retainPyodide(): () => void {
  cellCount += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    cellCount -= 1;
    if (cellCount <= 0) {
      cellCount = 0;
      client?.dispose();
      client = null;
    }
  };
}
