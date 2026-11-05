/*
 * CHAT-AGENT-P2-02 — The chat reply as the browser's speech engine should read it.
 *
 * Replies are markdown. Voice turns ask the model for plain short prose (the route's voice
 * note), but the model doesn't always comply, and a markdown reply read verbatim says
 * «asterisco asterisco» or spells out a URL. So, line by line: code blocks, images, raw HTML,
 * rules and table separators go; links read as their text (dropped when the text is itself a
 * URL or a path); bare URLs go; heading, quote and list markers go; bold / italic / strike /
 * inline code keep their text. Every block ends as a sentence, so list items and headings
 * don't run into each other. Pure, no DOM.
 *
 * The result is capped at `maxChars`, cut at the last sentence end that fits (or the last
 * space, with «…»): a reply that is long anyway is better read in part than for a minute.
 */

export const SPEAKABLE_MAX_CHARS = 600;

const URL_RE        = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const URLISH_RE     = /^(?:https?:\/\/|www\.|\/)\S*$|^[\w-]+(?:\.[\w-]+)+\/?\S*$/i;
const SENTENCE_END  = /[.!?…:;]$/;

/** One markdown line → its speakable text (may be empty). */
function speakLine(line: string): string {
  let s = line;

  // Table separator rows and horizontal rules carry nothing.
  if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(s)) return "";
  if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(s)) return "";

  s = s.replace(/<[^>]+>/g, " ");                         // raw HTML tags
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, "");           // images
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, (_m, text: string) =>
    URLISH_RE.test(text.trim()) ? "" : text);              // links → their text
  s = s.replace(URL_RE, "");                               // bare URLs

  s = s.replace(/^\s{0,3}#{1,6}\s+/, "");                  // headings
  s = s.replace(/^\s*(>\s*)+/, "");                        // blockquotes
  s = s.replace(/^\s*(?:[-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?/, ""); // list markers, task boxes

  s = s.replace(/`([^`]*)`/g, "$1");                       // inline code
  s = s.replace(/(\*\*|__)(.+?)\1/g, "$2");                // bold
  s = s.replace(/~~(.+?)~~/g, "$1");                       // strike
  s = s.replace(/(^|[^\w*])\*(?!\s)(.+?)\*(?!\w)/g, "$1$2"); // *italic*
  s = s.replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, "$1$2");  // _italic_ (not snake_case)

  // Table rows: cells read as a list.
  if (s.includes("|")) {
    s = s.split("|").map((c) => c.trim()).filter(Boolean).join(", ");
  }

  s = s.replace(/\(\s*\)/g, "");                           // «( )» left by a dropped URL
  s = s.replace(/\s+([,.;:!?])/g, "$1");                   // space before punctuation
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[\s,;:(\-–]+$/, "").trim();               // dangling «Mira:» after a dropped link
  return s;
}

/** Cuts at the last sentence end inside the cap, else the last space, with «…». */
function cap(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence >= maxChars / 3) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(" ");
  return `${(space > 0 ? head.slice(0, space) : head).replace(/[\s,;:.]+$/, "")}…`;
}

export function toSpeakableText(markdown: string, maxChars = SPEAKABLE_MAX_CHARS): string {
  const withoutCode = markdown.replace(/^\s*(```|~~~)[\s\S]*?^\s*\1\s*$/gm, "");
  const sentences = withoutCode
    .split(/\r?\n/)
    .map(speakLine)
    .filter((l) => /[\p{L}\p{N}]/u.test(l))
    .map((l) => (SENTENCE_END.test(l) ? l.replace(/[:;]$/, ".") : `${l}.`));
  return cap(sentences.join(" "), maxChars);
}
