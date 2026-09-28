/**
 * COURSE-P9-02 — the module-level query store behind the sidebar search field.
 *
 * Each case gets a fresh module so the Map never leaks between them. The unit project runs in
 * the `node` environment, where `window` is undefined — so the guard branch is the default and
 * the browser branch is exercised by stubbing `window` for one case.
 */

type Store = typeof import("../sidebar-query-store");

function freshStore(): Store {
  let store!: Store;
  jest.isolateModules(() => {
    store = require("../sidebar-query-store") as Store;
  });
  return store;
}

const withWindow = <T>(fn: () => T): T => {
  const g = globalThis as { window?: unknown };
  g.window = {};
  try {
    return fn();
  } finally {
    delete g.window;
  }
};

describe("sidebarQueryKey", () => {
  it("scopes the query to one course and one locale", () => {
    const { sidebarQueryKey } = freshStore();
    expect(sidebarQueryKey("dl-nlp", "en")).toBe("dl-nlp:en");
    expect(sidebarQueryKey("dl-nlp", "es")).not.toBe(sidebarQueryKey("dl-nlp", "en"));
  });
});

describe("read/write", () => {
  it("returns an empty string for a key nothing has written", () => {
    const { readSidebarQuery } = freshStore();
    withWindow(() => expect(readSidebarQuery("dl-nlp:es")).toBe(""));
  });

  it("returns what was last written", () => {
    const { readSidebarQuery, writeSidebarQuery } = freshStore();
    withWindow(() => {
      writeSidebarQuery("dl-nlp:es", "atención");
      expect(readSidebarQuery("dl-nlp:es")).toBe("atención");
      writeSidebarQuery("dl-nlp:es", "atención multi");
      expect(readSidebarQuery("dl-nlp:es")).toBe("atención multi");
    });
  });

  it("writing an empty string clears the key", () => {
    const { readSidebarQuery, writeSidebarQuery } = freshStore();
    withWindow(() => {
      writeSidebarQuery("dl-nlp:es", "atención");
      writeSidebarQuery("dl-nlp:es", "");
      expect(readSidebarQuery("dl-nlp:es")).toBe("");
    });
  });

  it("keeps courses and locales independent", () => {
    const { readSidebarQuery, writeSidebarQuery } = freshStore();
    withWindow(() => {
      writeSidebarQuery("dl-nlp:es", "atención");
      expect(readSidebarQuery("dl-nlp:en")).toBe("");
      expect(readSidebarQuery("otro-curso:es")).toBe("");
    });
  });

  it("never returns a stored query without a window — the server renders an empty field", () => {
    const { readSidebarQuery, writeSidebarQuery } = freshStore();
    writeSidebarQuery("dl-nlp:es", "atención");
    expect(typeof window).toBe("undefined");
    expect(readSidebarQuery("dl-nlp:es")).toBe("");
    // The write itself landed — the same key reads back once a window exists.
    withWindow(() => expect(readSidebarQuery("dl-nlp:es")).toBe("atención"));
  });
});
