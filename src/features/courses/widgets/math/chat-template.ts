/*
 * COURSE-C2-P1-02 — The chat template, for `chat-template` (llm-agents Block 2 lesson 2,
 * «La plantilla de chat es un formato entrenado»).
 *
 * A list of messages becomes the ONE token sequence a model reads, in two ways the widget
 * puts side by side:
 *
 *   - with SPECIAL TOKENS, the mini-GPT's template and the lesson's `plantilla`: each
 *     message is its role token, the tokens of `codificar(contenido)` and the end token.
 *     The four specials sit after the mini-GPT's 512 entries (ids 512–515), and the BPE
 *     never produces an id above 511 from text, so no content can write one;
 *   - with TEXT MARKERS, the lesson's counterexample: `Rol: contenido\n` per message, the
 *     whole string through the same BPE. A content that contains a line starting with a
 *     marker reads back as a message nobody wrote.
 *
 * Both modes are READ BACK the way a training pipeline that only has the token sequence
 * would read them (`readSpecial`, `readText`), and the loss mask is computed from that
 * reading — so a forged line in text mode is shown carrying loss, which is the point.
 *
 * The mask marks the tokens a training run predicts with loss: the content of every
 * assistant message and the token that closes it (its end token, or the `\n` in text
 * mode). The role token is written by the harness and never carries loss. With the mask
 * off, every token but the first does — the first is given, not predicted (Block 1
 * lesson 1).
 *
 * Pure and DOM-free; the BPE is `bpe-merges.ts`, the port of the course's `bpe.py`.
 * `__tests__/chat-template.test.ts` holds the special-token template to the ids the
 * lesson's first cell prints.
 */

import { encode, utf8, vocabulary, type MergeStep } from "./bpe-merges";

/** The mini-GPT's vocabulary size; the specials come right after it. */
export const SPECIAL_BASE = 512;

export const ROLES = ["sistema", "usuario", "asistente"] as const;
export type Role = (typeof ROLES)[number];

/** Role → its special token id: 512, 513, 514. */
export const ROLE_ID: Readonly<Record<Role, number>> = { sistema: 512, usuario: 513, asistente: 514 };
/** The end-of-message token, 515. */
export const END_ID = 515;

export interface Message {
  readonly role: Role;
  readonly content: string;
}

export type Merges = readonly Pick<MergeStep, "pair" | "id">[];

export interface TemplateToken {
  /** < 512: an entry of the BPE vocabulary. ≥ 512: a special token. */
  readonly id: number;
  /** Index of the message this token belongs to, AS THE SEQUENCE READS BACK. */
  readonly message: number;
  /** The role of that message, as read back. */
  readonly role: Role;
  /** True when a training run counts this token's loss: an assistant's content or closer. */
  readonly response: boolean;
}

export interface TemplateResult {
  readonly tokens: readonly TemplateToken[];
  /** The messages a reader of the token sequence recovers. Equal to the input iff injective here. */
  readonly readBack: readonly Message[];
}

export const isSpecial = (id: number) => id >= SPECIAL_BASE;

/** `plantilla(mensajes)` in the lesson: role token, content tokens, end token, per message. */
export function templateIds(messages: readonly Message[], merges: Merges): number[] {
  return messages.flatMap((m) => [ROLE_ID[m.role], ...encode(m.content, merges), END_ID]);
}

const ROLE_OF_ID = new Map<number, Role>(ROLES.map((r) => [ROLE_ID[r], r]));

/**
 * Read a special-token sequence back into messages: a role token opens a message, the end
 * token closes it, everything between is content. It never looks at the content's bytes,
 * which is why no content can move a boundary. Tokens outside any message are dropped.
 */
export function readSpecial(ids: readonly number[], merges: Merges): Message[] {
  const vocab = vocabulary(merges);
  const out: Message[] = [];
  let role: Role | null = null;
  let body: number[] = [];
  for (const id of ids) {
    const opens = ROLE_OF_ID.get(id);
    if (opens !== undefined) {
      role = opens;
      body = [];
    } else if (id === END_ID) {
      if (role !== null) {
        const bytes = body.flatMap((b) => vocab[b]);
        out.push({ role, content: new TextDecoder().decode(new Uint8Array(bytes)) });
      }
      role = null;
    } else if (role !== null) {
      body.push(id);
    }
  }
  return out;
}

/** The special-token template with each token's message, role and mask. */
export function renderSpecial(messages: readonly Message[], merges: Merges): TemplateResult {
  const tokens: TemplateToken[] = [];
  messages.forEach((m, i) => {
    const response = m.role === "asistente";
    tokens.push({ id: ROLE_ID[m.role], message: i, role: m.role, response: false });
    for (const id of encode(m.content, merges)) tokens.push({ id, message: i, role: m.role, response });
    tokens.push({ id: END_ID, message: i, role: m.role, response });
  });
  return { tokens, readBack: readSpecial(templateIds(messages, merges), merges) };
}

/** Text markers: the word each role is written with, `Usuario` → `Usuario: …\n`. */
export type Markers = Readonly<Record<Role, string>>;

/** The text template as one string: `Marcador: contenido\n` per message. */
export function textTemplate(messages: readonly Message[], markers: Markers): string {
  return messages.map((m) => `${markers[m.role]}: ${m.content}\n`).join("");
}

interface TextSpan {
  readonly role: Role;
  /** Byte offsets in the string: the marker prefix `Rol: `, then content, then its `\n`. */
  readonly start: number;
  readonly contentStart: number;
  readonly end: number;
}

/**
 * Read a text-template string back: a line that starts with `Marcador: ` opens a message;
 * any other line continues the current one. Spans are in BYTES, so tokens can be placed.
 */
function textSpans(text: string, markers: Markers): { spans: TextSpan[]; readBack: Message[] } {
  const spans: TextSpan[] = [];
  const readBack: Message[] = [];
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  let at = 0;
  for (const line of lines) {
    const lineBytes = utf8(line).length + 1; // with its \n
    const role = ROLES.find((r) => line.startsWith(`${markers[r]}: `));
    if (role !== undefined) {
      const prefix = utf8(`${markers[role]}: `).length;
      spans.push({ role, start: at, contentStart: at + prefix, end: at + lineBytes });
      readBack.push({ role, content: line.slice(markers[role].length + 2) });
    } else if (spans.length > 0) {
      const last = spans[spans.length - 1];
      spans[spans.length - 1] = { ...last, end: at + lineBytes };
      const prev = readBack[readBack.length - 1];
      readBack[readBack.length - 1] = { role: prev.role, content: `${prev.content}\n${line}` };
    }
    at += lineBytes;
  }
  return { spans, readBack };
}

/** The same messages as a text-template string, read back, with the mask that reading gives. */
export function renderText(
  messages: readonly Message[],
  merges: Merges,
  markers: Markers,
): TemplateResult & { readonly text: string } {
  const text = textTemplate(messages, markers);
  const { spans, readBack } = textSpans(text, markers);
  const vocab = vocabulary(merges);
  const tokens: TemplateToken[] = [];
  let at = 0;
  for (const id of encode(text, merges)) {
    at += vocab[id].length;
    const last = at - 1; // a token belongs where its LAST byte is: « Verde» is content
    const k = spans.findIndex((s) => last >= s.start && last < s.end);
    const span = spans[Math.max(k, 0)];
    const inContent = k >= 0 && last >= span.contentStart;
    tokens.push({ id, message: Math.max(k, 0), role: span.role, response: inContent && span.role === "asistente" });
  }
  return { tokens, readBack, text };
}

/** Does a token carry loss? With the mask, only responses; without, all but the first. */
export function carriesLoss(tokens: readonly TemplateToken[], index: number, masked: boolean): boolean {
  if (index === 0) return false;
  return masked ? tokens[index].response : true;
}

/** Two message lists are the same conversation. */
export function sameMessages(a: readonly Message[], b: readonly Message[]): boolean {
  return a.length === b.length && a.every((m, i) => m.role === b[i].role && m.content === b[i].content);
}
