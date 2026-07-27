/*
 * COURSE-P2-02 — Tokenisation tests: three modes, Spanish NFC handling, and BPE
 * mechanics against a controlled merge table plus committed-vocab invariants.
 *
 * Every accented / enye value is built from `String.fromCharCode` (pure-ASCII
 * source) so the assertions never depend on how this file is saved on disk, and
 * the NFD cases are guaranteed decomposed (base letter + a combining mark).
 */

import {
  tokenizeWords,
  tokenizeChars,
  tokenizeSubwords,
  CONTINUATION,
} from "../tokenisation";
import { type BpeMerge } from "../bpe-vocab";

const strip = (t: string) => (t.startsWith(CONTINUATION) ? t.slice(CONTINUATION.length) : t);

// Composed (NFC) — single code points.
const A_ACUTE = String.fromCharCode(0x00e1); // á
const O_ACUTE = String.fromCharCode(0x00f3); // ó
const U_ACUTE = String.fromCharCode(0x00fa); // ú
const N_TILDE = String.fromCharCode(0x00f1); // ñ
const INV_Q = String.fromCharCode(0x00bf); // ¿
// Combining marks, for building decomposed (NFD) inputs.
const COMB_ACUTE = String.fromCharCode(0x0301);
const COMB_TILDE = String.fromCharCode(0x0303);
const A_ACUTE_NFD = "a" + COMB_ACUTE; // 'a' + combining acute
const N_TILDE_NFD = "n" + COMB_TILDE; // 'n' + combining tilde

describe("tokenizeWords", () => {
  it("splits words, numbers and punctuation, dropping whitespace", () => {
    const input = `${INV_Q}C${O_ACUTE}mo est${A_ACUTE}s, t${U_ACUTE}?`;
    expect(tokenizeWords(input)).toEqual([
      INV_Q,
      `C${O_ACUTE}mo`,
      `est${A_ACUTE}s`,
      ",",
      `t${U_ACUTE}`,
      "?",
    ]);
    expect(tokenizeWords("son 42 gatos")).toEqual(["son", "42", "gatos"]);
  });

  it("keeps accented letters and enye inside a single word token", () => {
    expect(tokenizeWords(`espa${N_TILDE}ol ni${N_TILDE}o`)).toEqual([
      `espa${N_TILDE}ol`,
      `ni${N_TILDE}o`,
    ]);
  });
});

describe("tokenizeChars", () => {
  it("treats an accented vowel as ONE character even from NFD input", () => {
    expect(A_ACUTE_NFD.length).toBe(2); // sanity: two code units before NFC
    expect(tokenizeChars(A_ACUTE_NFD)).toEqual([A_ACUTE]);
  });

  it("treats enye as ONE character even from NFD input", () => {
    expect(tokenizeChars(`${N_TILDE_NFD}o`)).toEqual([N_TILDE, "o"]);
  });

  it("includes spaces as characters (a char-level model sees them)", () => {
    expect(tokenizeChars("a b")).toEqual(["a", " ", "b"]);
  });
});

describe("tokenizeSubwords — mechanics (controlled merges)", () => {
  const merges: readonly BpeMerge[] = [
    { pair: ["a", "b"] }, // rank 0
    { pair: ["ab", "c"] }, // rank 1
  ];

  it("greedily glues by priority into a single piece", () => {
    expect(tokenizeSubwords("abc", merges)).toEqual(["abc"]);
  });

  it("marks continuation pieces with the ## prefix", () => {
    // "abca": a+b -> ab, ab+c -> abc, trailing "a" cannot merge -> two pieces.
    expect(tokenizeSubwords("abca", merges)).toEqual(["abc", "##a"]);
  });

  it("leaves single characters unmerged when no rule applies", () => {
    expect(tokenizeSubwords("xyz", merges)).toEqual(["x", "##y", "##z"]);
  });
});

describe("tokenizeSubwords — committed vocab", () => {
  it("segments a long word into multiple pieces that rejoin to the lower-cased word", () => {
    const word = `Tokenizaci${O_ACUTE}n`;
    const pieces = tokenizeSubwords(word);
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    expect(pieces.map(strip).join("")).toBe(word.toLowerCase());
  });

  it("passes punctuation through as its own token (no ## prefix)", () => {
    const out = tokenizeSubwords("hola!");
    expect(out[out.length - 1]).toBe("!");
  });

  it("normalises NFD input before segmenting", () => {
    const word = `ni${N_TILDE_NFD}o`; // "nino" with a decomposed enye
    const pieces = tokenizeSubwords(word);
    expect(pieces.map(strip).join("")).toBe(`ni${N_TILDE}o`);
  });
});
