/*
 * COURSE-C2-P1-03 — What one call to the model can hold, for `context-window` (llm-agents
 * Block 3 lesson 5, «La ventana de contexto es un recurso escaso»; reused by Block 4's lesson
 * on state and memory and Block 5's on compaction, which add their own presets).
 * COURSE-C2-P1-04 — Block 4 lesson 6 adds the `agente` preset and the rule that segments
 * sharing a drop rank leave together.
 *
 * A call is an ORDERED list of segments, the order the plantilla writes them in: the prompt
 * de sistema, the ejemplos, the turns of the conversation, the pasajes, the caso (here a
 * question), and last the space reserved for the respuesta (`max_tokens`: the harness cannot
 * know the respuesta's length before it is written, so it keeps room for the most it allows). Each segment has a
 * size in tokens and, if the harness may leave it out, a drop rank: lower ranks go first.
 * A segment with no rank is pinned. `fitWindow` decides what enters a window of `tCtx`
 * tokens under one of three policies:
 *
 *   - "front" — nobody decides: the model keeps the LAST tCtx − reserve tokens of the prompt,
 *     as the mini-GPT's `modelo` does (Block 1 lesson 9), and the first segments fall off
 *     whole, then one is cut through the middle. The prompt de sistema is the first to go;
 *   - "drop" — the harness decides, whole segments only: it removes droppable segments in
 *     rank order until the rest fits. Segments that share a rank are one unit and leave
 *     together (Block 4's turno: its llamadas and their observaciones, since a `tool_use`
 *     without its `tool_result` is a call the protocol refuses). Pinned segments never leave;
 *     if they alone overflow, the call does not fit and nothing is cut;
 *   - "compact" — the harness first replaces every compactable segment but the last
 *     `keepRecent` with ONE summary of `summaryTokens`, written where the first of them was
 *     (the summary and the recent turns are then pinned), and only if that is not enough
 *     drops the rest in rank order. Compacting happens only when the call overflows.
 *
 * Whatever the policy, segments that stay keep their order: the harness chooses WHAT enters,
 * never rearranges it. Everything here is integers and pure, so the tests can check each
 * policy's invariants against a brute-force recount.
 */

export type Policy = "front" | "drop" | "compact";

export interface Segment {
  /** Unique within a preset; also what the component keys on. */
  readonly id: string;
  /** Picks the colour and the label (`courses.widgets.context-window.kinds.<kind>`). */
  readonly kind: string;
  /** The n in the label («Turno 3», «Pasaje 2»); absent for a one-off segment. */
  readonly n?: number;
  readonly tokens: number;
  /** Lower drops first; absent = pinned. */
  readonly drop?: number;
  /** Folded into the summary by "compact". */
  readonly compactable?: boolean;
}

export interface WindowPreset {
  /** In prompt order. The reserve (kind "respuesta") is the last segment. */
  readonly segments: readonly Segment[];
  /** The summary's size when "compact" fires. */
  readonly summaryTokens: number;
  /** How many of the last compactable segments "compact" keeps verbatim. */
  readonly keepRecent: number;
  readonly tCtxMin: number;
  readonly tCtxMax: number;
  readonly tCtxStep: number;
  readonly tCtxDefault: number;
}

export type Status = "whole" | "cut" | "dropped" | "compacted";

export interface Placed {
  readonly segment: Segment;
  /** Tokens of it that enter the call: its size, part of it ("cut"), or 0. */
  readonly kept: number;
  readonly status: Status;
}

export interface Fit {
  /** Every original segment, in order, with what happened to it. */
  readonly placed: readonly Placed[];
  /** What the call holds, in order: the kept segments, and the summary where it went. */
  readonly call: readonly Placed[];
  /** Tokens in the call, the reserve included. */
  readonly used: number;
  /** Tokens the harness has, the reserve included: the sum of every segment. */
  readonly total: number;
  /** False when even the pinned segments do not fit ("drop", "compact"). */
  readonly fits: boolean;
  /** The summary "compact" wrote, and how many tokens it read to write them. */
  readonly summary?: { readonly segment: Segment; readonly replaced: number };
}

export const SUMMARY_ID = "resumen";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

/** The reserve: the last segment, which every policy keeps. */
function reserveOf(segments: readonly Segment[]): number {
  return segments[segments.length - 1].tokens;
}

/** The model keeps the last tCtx − reserve tokens of the prompt, and nothing decides which. */
function fitFront(segments: readonly Segment[], tCtx: number): Fit {
  const total = sum(segments.map((s) => s.tokens));
  const prompt = segments.slice(0, -1);
  let room = Math.max(0, tCtx - reserveOf(segments));
  const keptFromEnd: Placed[] = [];
  for (let i = prompt.length - 1; i >= 0; i--) {
    const s = prompt[i];
    const kept = Math.min(s.tokens, room);
    room -= kept;
    keptFromEnd.push({
      segment: s,
      kept,
      status: kept === s.tokens ? "whole" : kept === 0 ? "dropped" : "cut",
    });
  }
  const reserve = segments[segments.length - 1];
  const placed = [...keptFromEnd.reverse(), { segment: reserve, kept: reserve.tokens, status: "whole" as const }];
  const call = placed.filter((p) => p.kept > 0);
  return { placed, call, used: sum(call.map((p) => p.kept)), total, fits: true };
}

/** The droppable segments grouped by rank, lowest first: each group leaves as one unit. */
export function dropGroups(segments: readonly Segment[]): Segment[][] {
  const ranks = [...new Set(segments.flatMap((s) => (s.drop === undefined ? [] : [s.drop])))].sort((a, b) => a - b);
  return ranks.map((r) => segments.filter((s) => s.drop === r));
}

/** Removes droppable groups by rank until the rest fits; never cuts a segment. */
function dropUntilFits(segments: readonly Segment[], tCtx: number): Set<string> {
  let used = sum(segments.map((s) => s.tokens));
  const out = new Set<string>();
  for (const group of dropGroups(segments)) {
    if (used <= tCtx) break;
    for (const s of group) {
      out.add(s.id);
      used -= s.tokens;
    }
  }
  return out;
}

function fitDrop(segments: readonly Segment[], tCtx: number): Fit {
  const total = sum(segments.map((s) => s.tokens));
  const out = dropUntilFits(segments, tCtx);
  const placed: Placed[] = segments.map((s) =>
    out.has(s.id) ? { segment: s, kept: 0, status: "dropped" } : { segment: s, kept: s.tokens, status: "whole" },
  );
  const call = placed.filter((p) => p.kept > 0);
  const used = sum(call.map((p) => p.kept));
  return { placed, call, used, total, fits: used <= tCtx };
}

function fitCompact(preset: WindowPreset, tCtx: number): Fit {
  const { segments, summaryTokens, keepRecent } = preset;
  const total = sum(segments.map((s) => s.tokens));
  if (total <= tCtx) return fitDrop(segments, tCtx);

  const compactable = segments.filter((s) => s.compactable);
  const folded = new Set(compactable.slice(0, Math.max(0, compactable.length - keepRecent)).map((s) => s.id));
  if (folded.size === 0) return fitDrop(segments, tCtx);

  // The call after compacting: the summary where the first folded segment was, the recent
  // compactable segments pinned with it, everything else as it came.
  const summary: Segment = { id: SUMMARY_ID, kind: "resumen", tokens: summaryTokens };
  const after: Segment[] = [];
  for (const s of segments) {
    if (folded.has(s.id)) {
      if (!after.some((a) => a.id === SUMMARY_ID)) after.push(summary);
    } else if (s.compactable) {
      after.push({ ...s, drop: undefined });
    } else {
      after.push(s);
    }
  }
  const out = dropUntilFits(after, tCtx);

  const placed: Placed[] = segments.map((s) => {
    if (folded.has(s.id)) return { segment: s, kept: 0, status: "compacted" };
    if (out.has(s.id)) return { segment: s, kept: 0, status: "dropped" };
    return { segment: s, kept: s.tokens, status: "whole" };
  });
  const call: Placed[] = after
    .filter((s) => !out.has(s.id))
    .map((s) => ({ segment: s, kept: s.tokens, status: "whole" }));
  const used = sum(call.map((p) => p.kept));
  const replaced = sum(segments.filter((s) => folded.has(s.id)).map((s) => s.tokens));
  return { placed, call, used, total, fits: used <= tCtx, summary: { segment: summary, replaced } };
}

/** What enters a call of tCtx tokens, under the policy. */
export function fitWindow(preset: WindowPreset, tCtx: number, policy: Policy): Fit {
  if (policy === "front") return fitFront(preset.segments, tCtx);
  if (policy === "drop") return fitDrop(preset.segments, tCtx);
  return fitCompact(preset, tCtx);
}

/*
 * The lesson's preset: an assistant about Marianela in its seventh call, with a prompt de
 * sistema, two ejemplos, six earlier turns (a question and its answer each), the five pasajes
 * the recuperador brought for this question (best first), the question, and 400 tokens
 * reserved for the respuesta. The sizes are the author's, round numbers of the order a real
 * tokenizer gives such texts; the lesson says so. Turns drop oldest first, then pasajes worst
 * first: the policy of the lesson's `encajar`.
 */
const TURN_TOKENS = [210, 150, 280, 170, 240, 190] as const;
const PASSAGE_TOKENS = [230, 260, 200, 240, 220] as const;

export const ASSISTANT_PRESET: WindowPreset = {
  segments: [
    { id: "sistema", kind: "sistema", tokens: 320 },
    { id: "ejemplo-1", kind: "ejemplo", n: 1, tokens: 130 },
    { id: "ejemplo-2", kind: "ejemplo", n: 2, tokens: 130 },
    ...TURN_TOKENS.map((tokens, i) => ({
      id: `turno-${i + 1}`,
      kind: "turno",
      n: i + 1,
      tokens,
      drop: 10 + i,
      compactable: true,
    })),
    ...PASSAGE_TOKENS.map((tokens, i) => ({
      id: `pasaje-${i + 1}`,
      kind: "pasaje",
      n: i + 1,
      tokens,
      drop: 30 - i,
    })),
    { id: "pregunta", kind: "pregunta", tokens: 40 },
    { id: "respuesta", kind: "respuesta", tokens: 400 },
  ],
  summaryTokens: 180,
  keepRecent: 2,
  tCtxMin: 768,
  tCtxMax: 4096,
  tCtxStep: 128,
  tCtxDefault: 2560,
};

/*
 * COURSE-C2-P1-04 — Block 4 lesson 6's preset (estado y memoria): an agent in its seventh call
 * of one task, the week's menu from the user's recipes. Every call carries the prompt de
 * sistema, the herramientas (name, description, esquema: they travel with each call), the
 * pedido, and each earlier turno as two segments, its llamadas and their observaciones.
 * The turnos are 1 `listar`, 2 and 3 three `leer` each, 4 `leer` of the list and the notes,
 * 5 `escribir` of the menu and 6 `escribir` of the list: a lectura weighs in its observación,
 * an escritura in its llamada, which carries the content. The sizes are the author's, round
 * numbers of the order a real tokenizer gives such texts; the lesson says so. A turno's two
 * segments share a drop rank, so "drop" removes them together, oldest first.
 */
const AGENT_TURNS: readonly (readonly [llamadas: number, observaciones: number])[] = [
  [30, 110],
  [80, 1_150],
  [80, 1_050],
  [60, 90],
  [440, 20],
  [150, 20],
];

export const AGENT_PRESET: WindowPreset = {
  segments: [
    { id: "sistema", kind: "sistema", tokens: 280 },
    { id: "herramientas", kind: "herramientas", tokens: 620 },
    { id: "pedido", kind: "pedido", tokens: 60 },
    ...AGENT_TURNS.flatMap(([llamadas, observaciones], i) => [
      { id: `llamadas-${i + 1}`, kind: "llamadas", n: i + 1, tokens: llamadas, drop: 10 + i, compactable: true },
      {
        id: `observaciones-${i + 1}`,
        kind: "observaciones",
        n: i + 1,
        tokens: observaciones,
        drop: 10 + i,
        compactable: true,
      },
    ]),
    { id: "respuesta", kind: "respuesta", tokens: 600 },
  ],
  summaryTokens: 200,
  keepRecent: 2,
  tCtxMin: 1_280,
  tCtxMax: 6_144,
  tCtxStep: 256,
  tCtxDefault: 3_584,
};

export const CONTEXT_WINDOW_PRESETS = {
  asistente: ASSISTANT_PRESET,
  agente: AGENT_PRESET,
} as const satisfies Record<string, WindowPreset>;

export type PresetName = keyof typeof CONTEXT_WINDOW_PRESETS;

export function isPresetName(name: unknown): name is PresetName {
  return typeof name === "string" && Object.prototype.hasOwnProperty.call(CONTEXT_WINDOW_PRESETS, name);
}
