// CONTENT-FEEDBACK-01 — the widget's reducer.
import {
  feedbackReducer as reduce,
  INITIAL_FEEDBACK_STATE as INITIAL,
  type FeedbackAction,
  type FeedbackState,
} from "../feedback-state";

function run(actions: FeedbackAction[], from: FeedbackState = INITIAL): FeedbackState {
  return actions.reduce(reduce, from);
}

describe("feedbackReducer — voting", () => {
  it("flips the thumb optimistically and thanks on a 👍 success", () => {
    const started = reduce(INITIAL, { type: "VOTE_START", vote: 1 });
    expect(started).toMatchObject({ vote: 1, voting: true, revertTo: null, panel: "none" });

    const done = reduce(started, { type: "VOTE_OK" });
    expect(done).toMatchObject({ vote: 1, voting: false, panel: "none", notice: "thanks" });
  });

  it("opens the comment box after a 👎 success", () => {
    const s = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_OK" }]);
    expect(s).toMatchObject({ vote: -1, panel: "comment", comment: "idle", notice: null });
  });

  it("reverts to the previous vote on failure and names the reason", () => {
    const voted = run([{ type: "VOTE_START", vote: 1 }, { type: "VOTE_OK" }]);

    const failed = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_FAIL", status: 500 }], voted);
    expect(failed).toMatchObject({ vote: 1, voting: false, notice: "error" });

    const limited = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_FAIL", status: 429 }], voted);
    expect(limited.notice).toBe("rateLimited");
  });

  it("reverts to null (= the remembered vote) when the first vote of the load fails", () => {
    const s = run([{ type: "VOTE_START", vote: 1 }, { type: "VOTE_FAIL", status: null }]);
    expect(s.vote).toBeNull();
  });

  it("ignores a second VOTE_START while one is in flight", () => {
    const inflight = reduce(INITIAL, { type: "VOTE_START", vote: 1 });
    expect(reduce(inflight, { type: "VOTE_START", vote: -1 })).toBe(inflight);
  });

  it("a new vote closes any open panel", () => {
    const withReport = reduce(INITIAL, { type: "OPEN_REPORT" });
    expect(reduce(withReport, { type: "VOTE_START", vote: 1 }).panel).toBe("none");
  });

  it("does not re-ask for a comment once one was sent", () => {
    const sent = run([
      { type: "VOTE_START", vote: -1 }, { type: "VOTE_OK" },
      { type: "COMMENT_SEND" }, { type: "COMMENT_OK" },
    ]);
    const again = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_OK" }], sent);
    expect(again).toMatchObject({ panel: "none", notice: "thanks" });
    expect(reduce(sent, { type: "OPEN_COMMENT" })).toBe(sent);
  });
});

describe("feedbackReducer — comment box", () => {
  const open = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_OK" }]);

  it("sends, then collapses with its own thank-you", () => {
    const sending = reduce(open, { type: "COMMENT_SEND" });
    expect(sending.comment).toBe("sending");
    expect(reduce(sending, { type: "COMMENT_OK" })).toMatchObject({
      panel: "none", comment: "sent", notice: "commentSent",
    });
  });

  it("keeps the box open on failure so the text is not lost", () => {
    const s = run([{ type: "COMMENT_SEND" }, { type: "COMMENT_FAIL", status: 429 }], open);
    expect(s).toMatchObject({ panel: "comment", comment: "idle", notice: "rateLimited" });
  });

  it("skipping and closing both count as a plain 👎", () => {
    expect(reduce(open, { type: "COMMENT_SKIP" })).toMatchObject({ panel: "none", notice: "thanks" });
    expect(reduce(open, { type: "CLOSE_PANEL" })).toMatchObject({ panel: "none", notice: "thanks" });
  });

  it("can be reopened by pressing the already-pressed 👎", () => {
    const skipped = reduce(open, { type: "COMMENT_SKIP" });
    expect(reduce(skipped, { type: "OPEN_COMMENT" })).toMatchObject({ panel: "comment", notice: null });
  });
});

describe("feedbackReducer — report box", () => {
  it("opens, sends, and disables itself afterwards", () => {
    const opened = reduce(INITIAL, { type: "OPEN_REPORT" });
    expect(opened.panel).toBe("report");

    const sent = run([{ type: "REPORT_SEND" }, { type: "REPORT_OK" }], opened);
    expect(sent).toMatchObject({ panel: "none", report: "sent", notice: "reportSent" });
    expect(reduce(sent, { type: "OPEN_REPORT" })).toBe(sent);
  });

  it("stays open with the text on failure", () => {
    const s = run([{ type: "OPEN_REPORT" }, { type: "REPORT_SEND" }, { type: "REPORT_FAIL", status: 500 }]);
    expect(s).toMatchObject({ panel: "report", report: "idle", notice: "error" });
  });

  it("closing the report box does not thank — nothing was sent", () => {
    const s = run([{ type: "OPEN_REPORT" }, { type: "CLOSE_PANEL" }]);
    expect(s).toMatchObject({ panel: "none", notice: null });
  });

  it("only one panel is open at a time", () => {
    const comment = run([{ type: "VOTE_START", vote: -1 }, { type: "VOTE_OK" }]);
    expect(reduce(comment, { type: "OPEN_REPORT" }).panel).toBe("report");
  });
});

describe("feedbackReducer — share and identity", () => {
  it("toggles the copied state", () => {
    const copied = reduce(INITIAL, { type: "SHARE_COPIED" });
    expect(copied.share).toBe("copied");
    expect(reduce(copied, { type: "SHARE_RESET" }).share).toBe("idle");
  });

  it("returns the same object when nothing changes", () => {
    expect(reduce(INITIAL, { type: "SHARE_RESET" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "CLOSE_PANEL" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "VOTE_OK" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "VOTE_FAIL", status: 500 })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "COMMENT_SEND" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "COMMENT_OK" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "REPORT_SEND" })).toBe(INITIAL);
    expect(reduce(INITIAL, { type: "REPORT_OK" })).toBe(INITIAL);
  });
});
