/*
 * COURSE-P2-03 — Tests for the code cell's capped output buffer.
 *
 * The worker exists so a runaway loop can't freeze the tab. The cap exists so a
 * runaway PRINT loop can't do the same thing through the DOM instead. Keeping the
 * LAST n lines (not the first) is the part worth pinning down: the end of a run is
 * where the answer, or the traceback, is.
 */

import { EMPTY_OUTPUT, MAX_OUTPUT_LINES, appendChunk } from "../output";

describe("appendChunk", () => {
  it("splits a chunk into lines tagged with its stream", () => {
    const state = appendChunk(EMPTY_OUTPUT, "stdout", "a\nb\n");
    expect(state.lines).toEqual([
      { stream: "stdout", text: "a" },
      { stream: "stdout", text: "b" },
    ]);
    expect(state.dropped).toBe(0);
  });

  it("appends across calls, preserving arrival order and stream", () => {
    let state = appendChunk(EMPTY_OUTPUT, "stdout", "epoch 0\n");
    state = appendChunk(state, "stderr", "warning\n");
    state = appendChunk(state, "stdout", "epoch 1\n");

    expect(state.lines).toEqual([
      { stream: "stdout", text: "epoch 0" },
      { stream: "stderr", text: "warning" },
      { stream: "stdout", text: "epoch 1" },
    ]);
  });

  describe("line reassembly across write-sized chunks", () => {
    // `print("suma:", x)` reaches us as several writes for one line. This is the
    // behaviour that broke first time round: joining fragments as separate lines.
    it("joins fragments of one line written in several chunks", () => {
      let state = appendChunk(EMPTY_OUTPUT, "stdout", "suma:");
      expect(state.open).toBe(true);
      state = appendChunk(state, "stdout", " 1.0");
      state = appendChunk(state, "stdout", "\n");

      expect(state.lines).toEqual([{ stream: "stdout", text: "suma: 1.0" }]);
      expect(state.open).toBe(false);
    });

    it("starts a new line once a newline has arrived", () => {
      let state = appendChunk(EMPTY_OUTPUT, "stdout", "linea 0\n");
      state = appendChunk(state, "stdout", "linea 1\n");
      expect(state.lines.map((line) => line.text)).toEqual(["linea 0", "linea 1"]);
    });

    it("handles a chunk carrying a line end plus the start of the next", () => {
      const state = appendChunk(EMPTY_OUTPUT, "stdout", "a\nb");
      expect(state.lines.map((line) => line.text)).toEqual(["a", "b"]);
      expect(state.open).toBe(true);
    });

    it("does not let stderr continue an open stdout line", () => {
      let state = appendChunk(EMPTY_OUTPUT, "stdout", "parcial");
      state = appendChunk(state, "stderr", "aviso\n");
      expect(state.lines).toEqual([
        { stream: "stdout", text: "parcial" },
        { stream: "stderr", text: "aviso" },
      ]);
    });

    it("treats a bare newline as terminating the open line", () => {
      let state = appendChunk(EMPTY_OUTPUT, "stdout", "hecho");
      state = appendChunk(state, "stdout", "\n");
      expect(state.lines).toEqual([{ stream: "stdout", text: "hecho" }]);
    });
  });

  it("never mutates the state it was given", () => {
    const before = appendChunk(EMPTY_OUTPUT, "stdout", "a");
    const snapshot = [...before.lines];
    appendChunk(before, "stdout", "b");
    expect(before.lines).toEqual(snapshot);
  });

  it("ignores an empty chunk", () => {
    expect(appendChunk(EMPTY_OUTPUT, "stdout", "")).toBe(EMPTY_OUTPUT);
  });

  it("keeps the LAST lines when the cap is exceeded, and counts what it dropped", () => {
    const state = appendChunk(EMPTY_OUTPUT, "stdout", "1\n2\n3\n4\n5\n", 3);
    expect(state.lines.map((line) => line.text)).toEqual(["3", "4", "5"]);
    expect(state.dropped).toBe(2);
  });

  it("accumulates the dropped count across several overflowing chunks", () => {
    let state = appendChunk(EMPTY_OUTPUT, "stdout", "1\n2\n3\n4\n", 2);
    expect(state.dropped).toBe(2);
    state = appendChunk(state, "stdout", "5\n6\n", 2);
    expect(state.lines.map((line) => line.text)).toEqual(["5", "6"]);
    expect(state.dropped).toBe(4);
  });

  it("does not drop anything at exactly the cap", () => {
    const state = appendChunk(EMPTY_OUTPUT, "stdout", "1\n2\n3\n", 3);
    expect(state.lines).toHaveLength(3);
    expect(state.dropped).toBe(0);
  });

  it("caps a tight print loop at the default budget", () => {
    let state = EMPTY_OUTPUT;
    for (let i = 0; i < 5_000; i += 1) {
      state = appendChunk(state, "stdout", `${i}\n`);
    }
    expect(state.lines).toHaveLength(MAX_OUTPUT_LINES);
    expect(state.lines[state.lines.length - 1].text).toBe("4999");
    expect(state.dropped).toBe(5_000 - MAX_OUTPUT_LINES);
  });
});
