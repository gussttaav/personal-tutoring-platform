/*
 * COURSE-P5-05 — `transformer-architecture`: the paper's Figure 1 as data (Block 5
 * lessons 1, 6 and 8). DOM-free, so the topology and the layout can be unit-tested
 * without a browser — the same reason every other widget keeps its numbers out of
 * its component.
 *
 * There are no "numbers" to verify here in the sense `math/rnn.ts` has them, and the
 * teaching claim is structural instead: of the fifteen boxes the figure draws, only
 * the three attention boxes MIX POSITIONS. Everything else — the embeddings, the
 * positional encoding, the position-wise network, every Add & Norm, the read-out —
 * acts on one position at a time and could not tell you what is in the next one.
 * That is the whole of Block 5 lesson 1's claim, so `mixesPositions` is the flag the
 * tests guard, alongside the two things a layout can silently get wrong: a box
 * outside the viewBox, and two boxes of one stack overlapping.
 *
 * NO HYPERLINKS. A component points at the lesson that builds it with a block, a
 * number and a TOPIC, and `lessonReference` renders that the way the course's prose
 * does («la lección 4 de este bloque, sobre las múltiples cabezas») — AUTHORING.md §2:
 * a bare ordinal is a reference that rots. It also means the widget is legible while
 * lessons 2–11 are still drafts, which is exactly when it is being written.
 *
 * Geometry is in viewBox units, y increasing DOWNWARD, and the stacks are drawn
 * bottom-to-top like the paper: inputs at the bottom, probabilities at the top. The
 * component array is in that same order, which is also the keyboard order.
 */

export type Stack = "encoder" | "decoder";

/** Where a component is explained. `topic` is the noun phrase the prose uses. */
export interface LessonRef {
  block: number;
  lesson: number;
  topic: string;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArchComponent {
  id: string;
  /** The box label, pre-split into lines: SVG does not wrap text. */
  label: string[];
  stack: Stack;
  box: Box;
  /** Does this box let one position see another? Only attention does. */
  mixesPositions: boolean;
  /** One line, plain text: the panel renders it, and the panel is HTML, not MDX. */
  description: string;
  /** The lesson that builds it. */
  lesson: LessonRef;
  /** Lessons that build a part of it. Empty for most boxes. */
  alsoLessons: LessonRef[];
}

export const VIEWBOX = { width: 322, height: 530 } as const;

const BOX_W = 130;
const BOX_H = 36;
const ENCODER_X = 16;
const DECODER_X = 176;

/** The longest a label line may be before it runs out of its box at 12 units. */
export const MAX_LABEL_CHARS = 20;

const enc = (y: number): Box => ({ x: ENCODER_X, y, w: BOX_W, h: BOX_H });
const dec = (y: number): Box => ({ x: DECODER_X, y, w: BOX_W, h: BOX_H });

const DENSOS: LessonRef = { block: 1, lesson: 6, topic: "las representaciones densas" };
const POSICIONAL: LessonRef = { block: 5, lesson: 5, topic: "la codificación posicional" };
const RESIDUALES: LessonRef = { block: 5, lesson: 6, topic: "los residuales y el layer norm" };
const MASCARAS: LessonRef = { block: 5, lesson: 7, topic: "el encoder, el decoder y las máscaras" };

export const TRANSFORMER_COMPONENTS: ArchComponent[] = [
  // ── El encoder, de abajo arriba ──────────────────────────────────────────
  {
    id: "embedding-entrada",
    label: ["Embedding", "de entrada"],
    stack: "encoder",
    box: enc(466),
    mixesPositions: false,
    description:
      "Cada token de la frase de entrada se cambia por su vector. Una fila por posición, y la misma tabla para todas.",
    lesson: DENSOS,
    alsoLessons: [],
  },
  {
    id: "pe-encoder",
    label: ["Codificación", "posicional"],
    stack: "encoder",
    box: enc(410),
    mixesPositions: false,
    description:
      "Se le suma a cada fila algo que depende de en qué posición está. Sin esto, nada de lo que hay encima sabría el orden.",
    lesson: POSICIONAL,
    alsoLessons: [],
  },
  {
    id: "atencion-encoder",
    label: ["Auto-atención", "multi-head"],
    stack: "encoder",
    box: enc(344),
    mixesPositions: true,
    description:
      "Cada posición pregunta a todas las demás y se lleva una mezcla de lo que hay en ellas. Es la única caja de esta columna que mira más allá de su propia fila.",
    lesson: { block: 5, lesson: 2, topic: "la auto-atención" },
    alsoLessons: [
      { block: 5, lesson: 3, topic: "el scaled dot-product" },
      { block: 5, lesson: 4, topic: "la atención multi-head" },
    ],
  },
  {
    id: "suma-norm-enc-1",
    label: ["Suma y layer norm"],
    stack: "encoder",
    box: enc(298),
    mixesPositions: false,
    description:
      "Suma lo que entró en la subcapa a lo que salió de ella y normaliza el resultado. Cada fila se normaliza con sus propias coordenadas, sin mirar a las demás.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "ffn-encoder",
    label: ["Perceptrón", "por posiciones"],
    stack: "encoder",
    box: enc(232),
    mixesPositions: false,
    description:
      "El perceptrón multicapa del bloque 2, de dos capas, aplicado a cada fila por separado y con los mismos pesos en todas.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "suma-norm-enc-2",
    label: ["Suma y layer norm"],
    stack: "encoder",
    box: enc(186),
    mixesPositions: false,
    description:
      "La segunda de la capa. Lo que sale de aquí es lo que la siguiente capa del encoder recibe, y lo que el decoder lee al final.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  // ── El decoder, de abajo arriba ────────────────────────────────────────
  {
    id: "embedding-salida",
    label: ["Embedding", "de salida"],
    stack: "decoder",
    box: dec(466),
    mixesPositions: false,
    description:
      "Lo mismo para lo ya escrito, corrido una posición: en el sitio de cada token entra el anterior, nunca él mismo.",
    lesson: DENSOS,
    alsoLessons: [MASCARAS],
  },
  {
    id: "pe-decoder",
    label: ["Codificación", "posicional"],
    stack: "decoder",
    box: dec(410),
    mixesPositions: false,
    description:
      "La misma suma que en la otra columna, con la misma fórmula: la posición 3 recibe lo que recibe la posición 3 de la entrada.",
    lesson: POSICIONAL,
    alsoLessons: [],
  },
  {
    id: "atencion-enmascarada",
    label: ["Auto-atención", "enmascarada"],
    stack: "decoder",
    box: dec(344),
    mixesPositions: true,
    description:
      "Auto-atención con las posiciones futuras tachadas: al escribir la palabra 4 se puede mirar de la 1 a la 4, y ni una más.",
    lesson: MASCARAS,
    alsoLessons: [],
  },
  {
    id: "suma-norm-dec-1",
    label: ["Suma y layer norm"],
    stack: "decoder",
    box: dec(298),
    mixesPositions: false,
    description:
      "La misma operación que en el encoder, y hay tres en esta columna porque hay tres subcapas.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "atencion-cruzada",
    label: ["Atención", "encoder-decoder"],
    stack: "decoder",
    box: dec(232),
    mixesPositions: true,
    description:
      "La atención del bloque anterior, entera: las consultas salen de lo que se está escribiendo, y las claves y los valores, de lo que el encoder leyó.",
    lesson: MASCARAS,
    alsoLessons: [{ block: 4, lesson: 6, topic: "la consulta, la clave y el valor" }],
  },
  {
    id: "suma-norm-dec-2",
    label: ["Suma y layer norm"],
    stack: "decoder",
    box: dec(186),
    mixesPositions: false,
    description:
      "La segunda de las tres, la que cierra la subcapa que mira al encoder.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "ffn-decoder",
    label: ["Perceptrón", "por posiciones"],
    stack: "decoder",
    box: dec(120),
    mixesPositions: false,
    description:
      "El mismo perceptrón por posiciones que en la otra columna, con sus propios pesos.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "suma-norm-dec-3",
    label: ["Suma y layer norm"],
    stack: "decoder",
    box: dec(74),
    mixesPositions: false,
    description:
      "La tercera y última de la capa del decoder.",
    lesson: RESIDUALES,
    alsoLessons: [],
  },
  {
    id: "salida-lineal",
    label: ["Proyección lineal", "y softmax"],
    stack: "decoder",
    box: dec(8),
    mixesPositions: false,
    description:
      "De las coordenadas de cada fila a una probabilidad por entrada del vocabulario. La misma proyección en todas las posiciones.",
    lesson: { block: 5, lesson: 8, topic: "la arquitectura completa del artículo" },
    alsoLessons: [],
  },
];

/** The dashed frame around the part of a stack that repeats N times. */
export interface RepeatedFrame {
  stack: Stack;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where the «× N» label sits, anchored at its end. */
  labelX: number;
  labelY: number;
}

export const REPEATED_FRAMES: RepeatedFrame[] = [
  { stack: "encoder", x: 10, y: 168, w: 142, h: 228, labelX: 146, labelY: 390 },
  { stack: "decoder", x: 170, y: 68, w: 140, h: 328, labelX: 304, labelY: 390 },
];

export interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function componentById(id: string): ArchComponent | undefined {
  return TRANSFORMER_COMPONENTS.find((c) => c.id === id);
}

export function stackOf(stack: Stack): ArchComponent[] {
  return TRANSFORMER_COMPONENTS.filter((c) => c.stack === stack);
}

/** The boxes that let one position see another — the three attention ones. */
export function mixingComponents(): ArchComponent[] {
  return TRANSFORMER_COMPONENTS.filter((c) => c.mixesPositions);
}

export const centreX = (box: Box): number => box.x + box.w / 2;
export const centreY = (box: Box): number => box.y + box.h / 2;

/**
 * The vertical arrows joining consecutive boxes of a stack, plus the one leaving the
 * top box. Flow is bottom-to-top, so an arrow runs from the TOP edge of the lower box
 * to the BOTTOM edge of the one above it.
 */
export function flowArrows(stack: Stack): Arrow[] {
  const boxes = stackOf(stack).map((c) => c.box);
  const arrows: Arrow[] = [];
  for (let i = 0; i < boxes.length - 1; i += 1) {
    const lower = boxes[i];
    const upper = boxes[i + 1];
    arrows.push({ x1: centreX(lower), y1: lower.y, x2: centreX(upper), y2: upper.y + upper.h });
  }
  return arrows;
}

/**
 * A residual connection: it taps the arrow that FEEDS a sublayer, runs down the outer
 * side of its column, and comes back into the Add & Norm box that closes that sublayer
 * — the "what went in" half of the sum. Returned as an SVG path, elbows and all.
 *
 * `from` is the id of the box below the sublayer, `sublayer` the sublayer's own box,
 * `to` the Add & Norm that closes it.
 */
export function residualPath(fromId: string, sublayerId: string, toId: string): string {
  const from = requireComponent(fromId);
  const sublayer = requireComponent(sublayerId);
  const to = requireComponent(toId);
  const outer = from.stack === "encoder" ? 6 : 316;
  const tapY = (from.box.y + (sublayer.box.y + sublayer.box.h)) / 2;
  const landX = from.stack === "encoder" ? to.box.x : to.box.x + to.box.w;
  return `M ${centreX(from.box)} ${tapY} H ${outer} V ${centreY(to.box)} H ${landX}`;
}

/** The three residual connections of each stack, as `[from, sublayer, to]` ids. */
export const RESIDUAL_LINKS: [string, string, string][] = [
  ["pe-encoder", "atencion-encoder", "suma-norm-enc-1"],
  ["suma-norm-enc-1", "ffn-encoder", "suma-norm-enc-2"],
  ["pe-decoder", "atencion-enmascarada", "suma-norm-dec-1"],
  ["suma-norm-dec-1", "atencion-cruzada", "suma-norm-dec-2"],
  ["suma-norm-dec-2", "ffn-decoder", "suma-norm-dec-3"],
];

/**
 * What the encoder hands the decoder: the keys and the values, out of the top of the
 * left column and into the cross-attention box. It is the only line in the drawing
 * that crosses from one stack to the other.
 */
export function crossAttentionPath(): string {
  const top = requireComponent("suma-norm-enc-2").box;
  const target = requireComponent("atencion-cruzada").box;
  const midX = (top.x + top.w + target.x) / 2;
  return `M ${centreX(top)} ${top.y} V ${top.y - 24} H ${midX} V ${centreY(target)} H ${target.x}`;
}

/**
 * How the course's prose names a lesson: never a bare ordinal (AUTHORING.md §2), and
 * «del bloque anterior» rather than «del bloque 4» when it is the preceding one, which
 * survives a renumbering of the syllabus.
 */
export function lessonReference(ref: LessonRef): string {
  const where =
    ref.block === 5 ? "de este bloque" : ref.block === 4 ? "del bloque anterior" : `del bloque ${ref.block}`;
  return `la lección ${ref.lesson} ${where}, sobre ${ref.topic}`;
}

function requireComponent(id: string): ArchComponent {
  const found = componentById(id);
  if (!found) {
    throw new Error(`transformer-architecture: no component with id ${id}`);
  }
  return found;
}
