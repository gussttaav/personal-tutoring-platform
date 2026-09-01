/*
 * COURSE-P2-03 — How tall a code editor is allowed to get before it scrolls.
 *
 * The output panel has been capped since the first version (`CodeOutput`, 320px);
 * the editor was not, so a `<PyCell>` rendered its author's listing at full height.
 * At the shipped content's sizes that is a wall: the longest cell in Block 1 is 142
 * lines ≈ 3,100px, four screens of code between the prose and the Ejecutar button,
 * with the output further down still. The thing the student must READ was bounded
 * and the thing they mostly SKIM was not.
 *
 * Lives in its own module so `PyCellClient` and `CodeChallengeCard` — two editors
 * with the same box metrics and the same problem — cannot drift apart.
 */

/** Visible code lines before an editor starts scrolling instead of growing. */
export const EDITOR_MAX_LINES = 20;

/** `line-height` of both editors. Kept here so the cap tracks the box, not a guess. */
const EDITOR_LINE_HEIGHT = 1.6;

/** Vertical padding of both editors (0.85rem top + bottom), as one value. */
const EDITOR_PADDING_Y = "1.7rem";

/*
 * 20 lines ≈ 464px at the editors' 0.85rem/1.6. Chosen so the editor, the toolbar and
 * the top of the 320px output panel share one laptop viewport, and so one section of
 * a typical cell (8–15 lines in these lessons) fits without scrolling at all.
 *
 * `em` — not `rem` — resolves against the box's OWN font-size, so changing the editor
 * font here or there re-derives the cap instead of silently showing more or fewer
 * lines. The `min(…, 60vh)` clause only bites on phones and short windows, where an
 * absolute 464px would push Ejecutar off the screen it was meant to keep it on.
 */
export const EDITOR_MAX_HEIGHT = `min(calc(${EDITOR_MAX_LINES * EDITOR_LINE_HEIGHT}em + ${EDITOR_PADDING_Y}), 60vh)`;

/** Does this code need the cap? Below the threshold nothing is hidden, so no toggle. */
export function isCapped(code: string): boolean {
  return code.split("\n").length > EDITOR_MAX_LINES;
}
