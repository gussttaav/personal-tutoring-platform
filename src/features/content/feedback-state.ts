/*
 * CONTENT-FEEDBACK-01 — the widget's state machine, as a pure reducer.
 *
 * Pulled out of ContentFeedback.tsx so the transitions can be tested in node
 * (there is no jsdom in this repo — `course-progress-state.ts` set the precedent).
 * The component owns the side effects (fetch, localStorage, focus); this owns
 * what is allowed to happen next.
 *
 * `vote` is the vote cast IN THIS PAGE LOAD; `null` means "none yet", and the
 * component falls back to the one remembered in localStorage. `revertTo` is the
 * pre-optimistic value a failed POST restores.
 *
 * Every transition returns the previous object when nothing changes, so a stray
 * dispatch never re-renders.
 */

export type VoteValue = 1 | -1;
export type Panel     = "none" | "comment" | "report";
export type SendState = "idle" | "sending" | "sent";
export type Notice    = null | "thanks" | "commentSent" | "reportSent" | "error" | "rateLimited";

export interface FeedbackState {
  vote:     VoteValue | null;
  revertTo: VoteValue | null;
  voting:   boolean;
  panel:    Panel;
  comment:  SendState;
  report:   SendState;
  share:    "idle" | "copied";
  notice:   Notice;
}

export const INITIAL_FEEDBACK_STATE: FeedbackState = {
  vote:     null,
  revertTo: null,
  voting:   false,
  panel:    "none",
  comment:  "idle",
  report:   "idle",
  share:    "idle",
  notice:   null,
};

export type FeedbackAction =
  | { type: "VOTE_START"; vote: VoteValue }
  | { type: "VOTE_OK" }
  | { type: "VOTE_FAIL"; status: number | null }
  | { type: "OPEN_COMMENT" }
  | { type: "COMMENT_SEND" }
  | { type: "COMMENT_OK" }
  | { type: "COMMENT_FAIL"; status: number | null }
  | { type: "COMMENT_SKIP" }
  | { type: "OPEN_REPORT" }
  | { type: "REPORT_SEND" }
  | { type: "REPORT_OK" }
  | { type: "REPORT_FAIL"; status: number | null }
  | { type: "CLOSE_PANEL" }
  | { type: "SHARE_COPIED" }
  | { type: "SHARE_RESET" };

const failNotice = (status: number | null): Notice => (status === 429 ? "rateLimited" : "error");

export function feedbackReducer(state: FeedbackState, action: FeedbackAction): FeedbackState {
  switch (action.type) {
    case "VOTE_START":
      if (state.voting) return state;
      // Optimistic: the thumb flips now; a failure restores `revertTo`. Any open
      // panel closes — a new vote supersedes whatever the previous one was asking.
      return { ...state, vote: action.vote, revertTo: state.vote, voting: true, panel: "none", notice: null };

    case "VOTE_OK":
      if (!state.voting) return state;
      // 👎 asks for the optional comment (unless one was already sent for this
      // page load); 👍 is done.
      return state.vote === -1 && state.comment !== "sent"
        ? { ...state, voting: false, revertTo: null, panel: "comment", comment: "idle" }
        : { ...state, voting: false, revertTo: null, notice: "thanks" };

    case "VOTE_FAIL":
      if (!state.voting) return state;
      return { ...state, vote: state.revertTo, revertTo: null, voting: false, notice: failNotice(action.status) };

    case "OPEN_COMMENT":
      if (state.panel === "comment" || state.comment === "sent" || state.voting) return state;
      return { ...state, panel: "comment", comment: "idle", notice: null };

    case "COMMENT_SEND":
      if (state.panel !== "comment" || state.comment !== "idle") return state;
      return { ...state, comment: "sending", notice: null };

    case "COMMENT_OK":
      if (state.comment !== "sending") return state;
      return { ...state, panel: "none", comment: "sent", notice: "commentSent" };

    case "COMMENT_FAIL":
      if (state.comment !== "sending") return state;
      // The panel stays open so the text is not lost.
      return { ...state, comment: "idle", notice: failNotice(action.status) };

    case "COMMENT_SKIP":
      if (state.panel !== "comment") return state;
      return { ...state, panel: "none", notice: "thanks" };

    case "OPEN_REPORT":
      if (state.panel === "report" || state.report === "sent") return state;
      return { ...state, panel: "report", report: "idle", notice: null };

    case "REPORT_SEND":
      if (state.panel !== "report" || state.report !== "idle") return state;
      return { ...state, report: "sending", notice: null };

    case "REPORT_OK":
      if (state.report !== "sending") return state;
      return { ...state, panel: "none", report: "sent", notice: "reportSent" };

    case "REPORT_FAIL":
      if (state.report !== "sending") return state;
      return { ...state, report: "idle", notice: failNotice(action.status) };

    case "CLOSE_PANEL":
      if (state.panel === "none") return state;
      // Closing the comment box IS skipping it; closing the report box is just closing.
      return state.panel === "comment"
        ? { ...state, panel: "none", notice: "thanks" }
        : { ...state, panel: "none" };

    case "SHARE_COPIED":
      return state.share === "copied" ? state : { ...state, share: "copied" };

    case "SHARE_RESET":
      return state.share === "idle" ? state : { ...state, share: "idle" };
  }
}
