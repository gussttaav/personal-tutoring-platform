/*
 * BLOG-27 — the latency-budget model behind the voice post's interactive figure. The prose
 * quotes these totals, so they are pinned here.
 */

import {
  CALL_GEN,
  DEFAULT_INPUT,
  NET_IN,
  RTT,
  SPECULATIVE_LEAD,
  TTFT,
  TWILIO_TARGET,
  computeBudget,
  tickStep,
  timelineDomain,
  type BudgetInput,
} from "../latency-budget/model";

const turn = (over: Partial<BudgetInput> = {}) => computeBudget({ ...DEFAULT_INPUT, ...over });

describe("computeBudget", () => {
  it("adds up to Twilio's 1,115 ms target for a plain turn", () => {
    const b = turn();
    expect(b.answer).toBe(TWILIO_TARGET);
    expect(b.firstSound).toBe(b.answer);
    expect(b.hasWork).toBe(false);
  });

  it("charges the end-of-turn wait directly to the answer", () => {
    expect(turn({ listen: "silence500" }).answer).toBe(TWILIO_TARGET + 150);
    expect(turn({ listen: "silence800" }).answer).toBe(TWILIO_TARGET + 450);
  });

  it("adds the search before the model call for classic RAG", () => {
    expect(turn({ search: "local" }).answer).toBe(TWILIO_TARGET + 8);
    expect(turn({ search: "rerank" }).answer).toBe(TWILIO_TARGET + 2780);
  });

  it("charges each sequential tool call its generation plus its run", () => {
    expect(turn({ tools: 1, toolMs: 8 }).answer).toBe(TWILIO_TARGET + CALL_GEN + 8);
    expect(turn({ tools: 3, toolMs: 2780 }).answer).toBe(TWILIO_TARGET + 3 * (CALL_GEN + 2780));
  });

  it("adds round trips per call for a remote MCP server", () => {
    const local = turn({ tools: 2, toolMs: 100 }).answer;
    expect(turn({ tools: 2, toolMs: 100, host: "mcpOpen" }).answer).toBe(local + 2 * RTT);
    expect(turn({ tools: 2, toolMs: 100, host: "mcpFresh" }).answer).toBe(local + 2 * 3 * RTT);
  });

  it("gives a filler the first sound only when there is work to wait for", () => {
    expect(turn({ filler: true }).firstSound).toBe(TWILIO_TARGET);
    const b = turn({ filler: true, tools: 1, toolMs: 2780 });
    expect(b.firstSound).toBe(TWILIO_TARGET);
    expect(b.answer).toBe(TWILIO_TARGET + CALL_GEN + 2780);
  });

  it("starts only the first step early when speculating", () => {
    const b = turn({ speculative: true, tools: 2, toolMs: 2780 });
    const [r1, r2] = b.segments.filter((s) => s.kind === "callGen");
    expect(r1.start).toBe(-SPECULATIVE_LEAD);
    expect(r1.speculative).toBe(true);
    // The first result lands at -1000 + 590 + 2780 = 2370, after the end of turn (445).
    expect(r2.start).toBe(-SPECULATIVE_LEAD + CALL_GEN + 2780);
    expect(r2.speculative).toBe(false);
    expect(b.answer).toBe(turn({ tools: 2, toolMs: 2780 }).answer - SPECULATIVE_LEAD - (NET_IN + 350));
  });

  it("never lets a speculative step finish the turn before the user is heard out", () => {
    const b = turn({ speculative: true, search: "local" });
    const final = b.segments.find((s) => s.kind === "ttft")!;
    expect(final.start).toBe(b.endOfTurn);
    expect(b.answer).toBe(TWILIO_TARGET);
  });

  it("clamps out-of-range input", () => {
    expect(turn({ tools: 9, toolMs: 1 }).segments.filter((s) => s.kind === "toolRun")).toHaveLength(3);
    expect(turn({ tools: -1 }).answer).toBe(TWILIO_TARGET);
  });

  it("puts the final model call on the model lane right after the work", () => {
    const b = turn({ tools: 1, toolMs: 8 });
    const final = b.segments.find((s) => s.kind === "ttft")!;
    expect(final.end - final.start).toBe(TTFT);
    expect(final.start).toBe(b.endOfTurn + CALL_GEN + 8);
  });
});

describe("timeline scale", () => {
  it("picks a tick step that leaves at most ten ticks", () => {
    expect(tickStep(2000)).toBe(250);
    expect(tickStep(4000)).toBe(500);
    expect(tickStep(12000)).toBe(2000);
  });

  it("covers the speech shown and the answer, on tick boundaries", () => {
    const b = turn({ tools: 3, toolMs: 4000, host: "mcpFresh" });
    const { lo, hi, step } = timelineDomain(b);
    expect(lo).toBeLessThanOrEqual(-1500);
    expect(hi).toBeGreaterThanOrEqual(b.answer);
    expect(Math.abs(lo % step)).toBe(0);
    expect(Math.abs(hi % step)).toBe(0);
  });
});
