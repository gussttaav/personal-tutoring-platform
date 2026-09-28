/*
 * COURSE-C2-P1-01 — `math/bpe-merges.ts`, checked two independent ways, as AUTHORING §7
 * asks of a widget's maths:
 *
 *   1. HAND CASES — merges, encodings and pre-tokens small enough to work out on paper,
 *      including the two traps: an overlapping pair (`a a a`) and a merge list that must
 *      be applied in rank order, not by the new text's own frequencies.
 *   2. PARITY WITH THE COURSE'S TOKENISER — trained on `public/courses/llm-agents/
 *      corpus.txt`, the port must reproduce `bpe-merges.json` merge for merge, and the
 *      numbers «BPE de verdad» quotes from its cells (Pyodide runs `bpe.py`, the file this
 *      ports) must come out of it too: the frequencies, the positions of `ñ`, `que`, `qu`,
 *      `ción`, the corpus at 2.16 bytes per token.
 *
 * The widget corpus's own numbers (the ones the lesson reads off the explorable) are in
 * `widgets/__tests__/corpora.test.ts`, next to the teaching property they pin.
 */

import fs from "node:fs";
import path from "node:path";

import {
  N_BYTES,
  decode,
  encode,
  meanBytesPerToken,
  mergePair,
  pretokens,
  tokenLabel,
  trainBpe,
  utf8,
  vocabulary,
  type MergeStep,
} from "../bpe-merges";

const ASSETS = path.join(process.cwd(), "public", "courses", "llm-agents");
/** `bpe.quitar_cabecera`: drop the source/licence line, then leading whitespace. */
const CORPUS = fs
  .readFileSync(path.join(ASSETS, "corpus.txt"), "utf8")
  .split("\n")
  .slice(1)
  .join("\n")
  .trimStart();
const FROZEN = JSON.parse(fs.readFileSync(path.join(ASSETS, "bpe-merges.json"), "utf8")) as [
  number,
  number,
][];
const FROZEN_MERGES = FROZEN.map((pair, i) => ({ pair, id: N_BYTES + i }) as const);

/** A token id as the string it spells (for readable assertions). */
const text = (bytes: number[]) => new TextDecoder().decode(new Uint8Array(bytes));

describe("bpe-merges — hand cases", () => {
  it("merges left to right without overlap", () => {
    expect(mergePair([1, 1, 1], [1, 1], 9)).toEqual([9, 1]);
    expect(mergePair([1, 1, 1, 1], [1, 1], 9)).toEqual([9, 9]);
    expect(mergePair([2, 1, 3, 1, 3], [1, 3], 9)).toEqual([2, 9, 9]);
    expect(mergePair([1, 2], [2, 1], 9)).toEqual([1, 2]);
  });

  it("cuts pre-tokens as bpe.py's PATRON does (outputs copied from CPython)", () => {
    expect(pretokens("¿Qué quieres?")).toEqual(["¿", "Qué", " quieres", "?"]);
    expect(pretokens("El año 1878, ½ y ²: hola!!  fin  ")).toEqual([
      "El", " año", " 1878", ",", " ½", " y", " ²", ":", " hola", "!!", " ", " fin", "  ",
    ]);
    expect(pretokens("dámelo...\n\nNo")).toEqual(["dámelo", "...", "\n", "\n", "No"]);
    // The P1-01 fix: `_` is a sign, not dropped.
    expect(pretokens("x__y  _ z")).toEqual(["x", "__", "y", " ", " _", " z"]);
    // Every character lands in some pre-token, so they concatenate back to the text.
    for (const s of ["a_b", "  hola\t\n mundo  ", "🙂 日本 ñ"]) expect(pretokens(s).join("")).toBe(s);
  });

  it("starts from UTF-8 bytes: ñ is two, an emoji four", () => {
    expect(utf8("año")).toEqual([0x61, 0xc3, 0xb1, 0x6f]);
    expect(utf8("🙂")).toHaveLength(4);
    expect(encode("año", [])).toEqual([0x61, 0xc3, 0xb1, 0x6f]);
  });

  it("trains the most frequent pair first, ties to the smallest ids", () => {
    // `abab ab`: pre-tokens «abab» and « ab». (a,b) occurs 3 times, (b,a) once,
    // (space,a) once → merge 1 is (a,b). Then (256,256) once and (space,256) once: the tie
    // goes to the smaller left id, the space (32).
    const { merges, stop } = trainBpe("abab ab", 5);
    expect(merges.map((m) => m.pair)).toEqual([
      [97, 98],
      [32, 256],
      [256, 256],
    ]);
    expect(merges.map((m) => m.freq)).toEqual([3, 1, 1]);
    expect(stop).toBe("min-freq");
    expect(merges[0].candidates.map((c) => c.freq)).toEqual([3, 1, 1]);
  });

  it("stops at minFreq, and never merges across a pre-token", () => {
    // Pre-tokens «no», « es», « no», « es»: the pair (o, space) never occurs inside one.
    // (space,e), (n,o), (e,s) tie at 2 → the space (32) goes first; « no» adds (space,n)
    // once, which is below minFreq and stops the run. Checked against bpe.py.
    const { merges } = trainBpe("no es no es", 10, 2);
    const vocab = vocabulary(merges);
    expect(merges.map((m) => text(vocab[m.id]))).toEqual([" e", "no", " es"]);
    expect(merges.every((m) => m.freq >= 2)).toBe(true);
  });

  it("encodes by rank, not by the new text's frequencies", () => {
    const merges = [
      { pair: [97, 98] as const, id: 256 }, // a + b
      { pair: [98, 99] as const, id: 257 }, // b + c
    ];
    // (b,c) is the only pair of «bcbc» but both appear in «abc»: (a,b) has rank 0 and wins.
    expect(encode("abc", merges)).toEqual([256, 99]);
    expect(encode("bcbc", merges)).toEqual([257, 257]);
    // A merge that uses another one waits for it.
    const nested = [
      { pair: [0xc3, 0xb1] as const, id: 256 }, // ñ
      { pair: [0x61, 256] as const, id: 257 }, // a + ñ
    ];
    expect(encode("año", nested)).toEqual([257, 0x6f]);
  });

  it("labels a piece of a character by its bytes, and a whole one by its text", () => {
    expect(tokenLabel([0xc3])).toEqual({ text: "C3", valid: false });
    expect(tokenLabel([0x20, 0xc2])).toEqual({ text: "20 C2", valid: false });
    expect(tokenLabel([0xc3, 0xb1])).toEqual({ text: "ñ", valid: true });
    expect(tokenLabel([0x20, 0x64, 0x65])).toEqual({ text: " de", valid: true });
  });

  it("takes one merge's worth of tokens off the corpus per occurrence (a ≠ b)", () => {
    // The lesson's T_i = T_{i-1} − f(a_i, b_i), checked on every step of a small run
    // whose merges all have a ≠ b — and the tokens counted by encoding with the first i
    // merges, which is also the claim that encoding reproduces the training segmentation.
    const corpus = "la niña y el niño cantaron una canción; la niña bailó";
    const { merges } = trainBpe(corpus, 30, 2);
    expect(merges.every((m) => m.pair[0] !== m.pair[1])).toBe(true);
    let previous = utf8(corpus).length;
    merges.forEach((m, i) => {
      const now = encode(corpus, merges.slice(0, i + 1)).length;
      expect(previous - now).toBe(m.freq);
      previous = now;
    });
  });
});

describe("bpe-merges — parity with the course's tokeniser (bpe.py, bpe-merges.json)", () => {
  // Trained once: 256 merges on 302 566 bytes, recounting every step.
  let merges: MergeStep[];
  beforeAll(() => {
    merges = trainBpe(CORPUS, 256).merges;
  }, 60_000); // ~5 s on a laptop; the default 5 s hook budget is too tight for CI

  it("reproduces bpe-merges.json merge for merge", () => {
    expect(merges).toHaveLength(256);
    expect(merges.map((m) => [...m.pair])).toEqual(FROZEN);
  });

  it("gives the frequencies the lesson's first cell prints, never increasing", () => {
    const f = merges.map((m) => m.freq);
    expect(f.slice(0, 5)).toEqual([4652, 4406, 4000, 3692, 3563]);
    expect(f[15]).toBe(2232); // fusión 16, `que`
    expect(f[19]).toBe(2027); // fusión 20, `.` + `.`, the overlapping pair
    expect(f[63]).toBe(628); // fusión 64
    expect(f[70]).toBe(597); // fusión 71, `ñ`: every ñ of the corpus
    expect(f[255]).toBe(117); // the last one
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThanOrEqual(f[i - 1]);
  });

  it("puts ñ, que, qu, ción and Nela where the lesson says (fusión = index + 1)", () => {
    const vocab = vocabulary(merges);
    const where = (s: string) => merges.findIndex((m) => text(vocab[m.id]) === s) + 1;
    expect(where(" d")).toBe(1);
    expect(where("que")).toBe(16);
    expect(where("í")).toBe(18);
    expect(where("..")).toBe(20);
    expect(where("—")).toBe(32);
    expect(where("qu")).toBe(65);
    expect(where("ñ")).toBe(71);
    expect(where(" Nela")).toBe(118);
    expect(where("ción")).toBe(131);
    // Three of the 256 are not text on their own: the tail of the raya, and a space or a
    // raya followed by the first byte of ¿ / ¡.
    const pieces = merges.filter((m) => !tokenLabel(vocab[m.id]).valid).map((m) => m.id - N_BYTES + 1);
    expect(pieces).toEqual([31, 73, 146]);
  });

  it("encodes as codificar does (ids copied from CPython), and back", () => {
    const vocab = vocabulary(FROZEN_MERGES);
    const cases: [string, number[]][] = [
      [
        "El señor dijo que la canción era pequeña.",
        [69, 108, 470, 343, 353, 278, 280, 263, 277, 386, 507, 510, 271, 326, 97, 46],
      ],
      [" criptomoneda", [263, 311, 112, 116, 306, 279, 101, 298]],
      ["🙂 日本", [240, 159, 153, 130, 32, 230, 151, 165, 230, 156, 172]],
      ["a_b", [97, 95, 98]],
    ];
    for (const [s, ids] of cases) {
      expect(encode(s, FROZEN_MERGES)).toEqual(ids);
      expect(decode(ids, vocab)).toBe(s);
    }
  });

  it("carries the corpus at 2.16 bytes per token after 256 merges, 1.59 after 64", () => {
    const all = encode(CORPUS, FROZEN_MERGES);
    expect(utf8(CORPUS)).toHaveLength(302566);
    expect(all).toHaveLength(139765);
    expect(meanBytesPerToken(CORPUS, all.length)).toBeCloseTo(2.165, 3);
    expect(encode(CORPUS, FROZEN_MERGES.slice(0, 64))).toHaveLength(189840);
    expect(decode(all, vocabulary(FROZEN_MERGES))).toBe(CORPUS);
  });
});
