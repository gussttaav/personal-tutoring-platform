/*
 * BLOG-27 — the latency budget of one voice turn, as a timeline (pure, unit-tested).
 *
 * Time 0 is the moment the user stops speaking; every segment is [start, end) in ms. The
 * figure draws what this returns, and the post's prose quotes the same constants, so a
 * number changed here must change there (content/blog/es/latencia-en-asistentes-de-voz.mdx,
 * header comment).
 *
 * Every constant is a published figure, not a measurement of ours:
 *   - NET_IN 95: Twilio, «A Guide to Core Latency in AI Voice Agents» (17 Nov 2025), waterfall
 *     caption: device to media edge 40 + buffering 30 + decoding 25.
 *   - LISTEN model 350 / TTFT 375 / TTS 100: the same guide's component targets (speech-to-text
 *     with end-of-turn detection, LLM time to first token, text-to-speech time to first byte).
 *   - NET_OUT 195: the rest of the guide's 1,115 ms mouth-to-ear target once 95 + 350 + 375 +
 *     100 are taken out (our subtraction): the way back plus the hops between services. The
 *     default turn therefore adds up to exactly Twilio's target.
 *   - LISTEN silence500: the same guide, «Most defaults are set around 500ms». silence800:
 *     the VAD minimum silence of the cascades in Heartbeat Thinking (arXiv 2610.26233, Table 4).
 *   - CALL_GEN 590: Stream RAG (arXiv 2510.02044), Table 3, query generation P50 0.59 s: the
 *     model writing its tool call (or search query) before anything can run.
 *   - SEARCH local 8: Ethiraj et al. (arXiv 2508.04721), Table 1, mean FAISS retrieval 0.008 s.
 *     rerank 2780: Stream RAG, Table 3, tool-result generation P50 2.78 s (search over the CRAG
 *     corpus, chunking and BGE re-ranking).
 *   - RTT 60: a lower bound, not a measurement. Light in fibre covers ~200 km per ms, and
 *     Madrid to the US east coast is ~6,000 km in a straight line: ≥ 30 ms each way.
 *   - SPECULATIVE_LEAD 1000: an assumption, stated in the figure: the request is clear 1 s
 *     before the user stops. Heartbeat Thinking's correct tool call lands 4.37 s before the
 *     end of speech on average (Table 5), so 1 s is the cautious side.
 */

export const NET_IN = 95;
export const NET_OUT = 195;
export const TTFT = 375;
export const TTS = 100;
export const CALL_GEN = 590;
export const RTT = 60;
export const SPECULATIVE_LEAD = 1000;
/** How much of the user's speech the timeline shows before time 0. */
export const SPEECH_SHOWN = 1500;

/** Reference lines. Stivers et al. 2009 (PNAS): cross-language mean response offset +208 ms,
 *  polar question–answer pairs in 10 languages. */
export const HUMAN_GAP = 208;
/** Dingemanse & Liesenfeld 2022 (ACL), Figure 4: mean of every dyadic turn transition in 24
 *  languages, Spanish among them. */
export const ALL_TURNS_GAP = 59;
/** Twilio's mouth-to-ear target, the default turn's total. */
export const TWILIO_TARGET = 1115;

export const LISTEN_MS = { model: 350, silence500: 500, silence800: 800 } as const;
export type ListenMode = keyof typeof LISTEN_MS;

export const SEARCH_MS = { none: 0, local: 8, rerank: 2780 } as const;
export type SearchMode = keyof typeof SEARCH_MS;

/** Round trips a tool call pays on top of its own time. */
export const TOOL_RTTS = { inProcess: 0, mcpOpen: 1, mcpFresh: 3 } as const;
export type ToolHost = keyof typeof TOOL_RTTS;

export const MAX_TOOLS = 3;
export const MAX_TOOL_MS = 4000;

export interface BudgetInput {
  listen: ListenMode;
  /** Retrieval BEFORE the model (classic RAG), with the transcript as the query. */
  search: SearchMode;
  /** Tool calls made one after another, each waiting for the previous result. */
  tools: number;
  /** What each tool takes to run, in ms. */
  toolMs: number;
  host: ToolHost;
  /** The model says a short phrase first («un momento, lo miro») when there is work to wait for. */
  filler: boolean;
  /** The first search or tool call starts on the partial transcript, before the user stops. */
  speculative: boolean;
}

export const DEFAULT_INPUT: BudgetInput = {
  listen: "model",
  search: "none",
  tools: 0,
  toolMs: SEARCH_MS.rerank,
  host: "inProcess",
  filler: false,
  speculative: false,
};

export type Lane = "user" | "network" | "listen" | "model" | "tool" | "voice";
export const LANES: readonly Lane[] = ["user", "network", "listen", "model", "tool", "voice"];

export type SegmentKind =
  | "speech"
  | "netIn"
  | "listen"
  | "search"
  | "callGen"
  | "toolRun"
  | "ttft"
  | "tts"
  | "netOut"
  | "fillerTtft"
  | "fillerTts"
  | "fillerNetOut";

export interface Segment {
  kind: SegmentKind;
  lane: Lane;
  start: number;
  end: number;
  /** Which tool call (1-based) a callGen/toolRun belongs to. */
  round?: number;
  /** Started before the user stopped speaking. */
  speculative?: boolean;
}

export interface Budget {
  segments: Segment[];
  /** The platform knows the user has finished: network in + end-of-turn detection. */
  endOfTurn: number;
  /** First sound the user hears (the filler, if there is one). */
  firstSound: number;
  /** The user hears the start of the actual answer. */
  answer: number;
  /** Work between the end of turn and the final model call (search + tools), as drawn. */
  hasWork: boolean;
}

export function clampInput(input: BudgetInput): BudgetInput {
  return {
    ...input,
    tools: Math.max(0, Math.min(MAX_TOOLS, Math.round(input.tools))),
    toolMs: Math.max(0, Math.min(MAX_TOOL_MS, Math.round(input.toolMs))),
  };
}

export function computeBudget(raw: BudgetInput): Budget {
  const input = clampInput(raw);
  const segments: Segment[] = [{ kind: "speech", lane: "user", start: -SPEECH_SHOWN, end: 0 }];

  segments.push({ kind: "netIn", lane: "network", start: 0, end: NET_IN });
  const endOfTurn = NET_IN + LISTEN_MS[input.listen];
  segments.push({ kind: "listen", lane: "listen", start: NET_IN, end: endOfTurn });

  // The chain of waits between the end of turn and the answer: the search, then each tool.
  // Only its FIRST step may start early (speculatively); every later step needs the final
  // transcript and the previous result, so it starts at max(end of turn, previous end).
  let cursor = endOfTurn;
  let first = true;
  const startOf = () => {
    if (first && input.speculative) return -SPECULATIVE_LEAD;
    return cursor;
  };

  const searchMs = SEARCH_MS[input.search];
  if (input.search !== "none") {
    const start = startOf();
    const end = start + searchMs;
    segments.push({ kind: "search", lane: "tool", start, end, speculative: start < 0 });
    cursor = Math.max(endOfTurn, end);
    first = false;
  }

  for (let round = 1; round <= input.tools; round++) {
    const start = startOf();
    const genEnd = start + CALL_GEN;
    const runEnd = genEnd + input.toolMs + TOOL_RTTS[input.host] * RTT;
    const speculative = start < 0;
    segments.push({ kind: "callGen", lane: "model", start, end: genEnd, round, speculative });
    segments.push({ kind: "toolRun", lane: "tool", start: genEnd, end: runEnd, round, speculative });
    cursor = Math.max(endOfTurn, runEnd);
    first = false;
  }

  const hasWork = input.search !== "none" || input.tools > 0;

  const ttftEnd = cursor + TTFT;
  const ttsEnd = ttftEnd + TTS;
  const answer = ttsEnd + NET_OUT;
  segments.push({ kind: "ttft", lane: "model", start: cursor, end: ttftEnd });
  segments.push({ kind: "tts", lane: "voice", start: ttftEnd, end: ttsEnd });
  segments.push({ kind: "netOut", lane: "network", start: ttsEnd, end: answer });

  let firstSound = answer;
  // A filler only helps when there is something to wait for. It is the first tokens of the
  // same response that then writes the tool call, so it costs a TTFT and a TTS after the end
  // of turn and delays nothing else (the few tokens it adds are ignored).
  if (input.filler && hasWork) {
    const fTtft = endOfTurn + TTFT;
    const fTts = fTtft + TTS;
    const fOut = fTts + NET_OUT;
    if (fOut < answer) {
      segments.push({ kind: "fillerTtft", lane: "model", start: endOfTurn, end: fTtft });
      segments.push({ kind: "fillerTts", lane: "voice", start: fTtft, end: fTts });
      segments.push({ kind: "fillerNetOut", lane: "network", start: fTts, end: fOut });
      firstSound = fOut;
    }
  }

  return { segments, endOfTurn, firstSound, answer, hasWork };
}

/** The timeline's x range: the speech shown (or the speculative lead) to past the answer. */
export function timelineDomain(budget: Budget): { lo: number; hi: number; step: number } {
  const min = Math.min(...budget.segments.map((s) => s.start));
  const max = Math.max(budget.answer, TWILIO_TARGET + 200);
  const step = tickStep(max - min);
  return { lo: Math.floor(min / step) * step, hi: Math.ceil(max / step) * step, step };
}

/** A tick spacing that leaves 5–10 ticks over the span. */
export function tickStep(span: number): number {
  for (const step of [250, 500, 1000, 2000, 5000]) {
    if (span / step <= 10) return step;
  }
  return 10000;
}
