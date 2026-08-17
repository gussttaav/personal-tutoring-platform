/*
 * COURSE-P2-01 — The set of valid `<Explorable id="…">` ids.
 *
 * This module is PURE DATA with zero imports on purpose: the content linter
 * (`scripts/lint-content.ts`, run under Node/tsx) validates every `<Explorable id>`
 * in the MDX against `WIDGET_IDS` and must NOT drag in `next/dynamic` or any client
 * `.tsx`. So the id list lives here, and `registry.ts` maps these ids to lazily
 * loaded components — typed `Record<WidgetId, …>`, which makes a missing or unknown
 * registry key a compile error just as `keyof typeof WIDGETS` would.
 *
 * Adding a widget = add its id here, then add its entry in `registry.ts`.
 */

export const WIDGET_IDS = [
  "sigmoid-explorer",
  // COURSE-P2-02 — Block 1 (NLP) + Block 2 (MLP) explorables.
  "tokenizer-playground",
  "embedding-projection",
  // COURSE-P5-01 — Block 1 lesson 5 (bolsa de palabras).
  "bag-of-words",
  "activation-explorer",
  "perceptron-boundary",
  "gradient-descent-2d",
  "backprop-trace",
  "loss-landscape",
  // COURSE-P5-03 — Block 3 (RNN) explorable, used by lessons 2 and 3.
  "rnn-unrolled",
  // COURSE-P5-03 — Block 3 (RNN) lesson 4 (gradiente desvanecido).
  "vanishing-gradient",
  // COURSE-P5-03 — Block 3 (RNN) lessons 5 and 6 (LSTM, GRU).
  "lstm-gates",
  // COURSE-P5-04 — Block 4 lesson 2 (el cuello de botella del vector de contexto).
  "context-bottleneck",
  // COURSE-P5-04 — Block 4 lessons 3 and 4 (la idea de atención, Bahdanau).
  "attention-alignment",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export function isWidgetId(id: string): id is WidgetId {
  return (WIDGET_IDS as readonly string[]).includes(id);
}
