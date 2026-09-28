/*
 * COURSE-P1-01 — MDX → React component map for course lessons.
 * COURSE-P2-01 — + `Explorable`, the entry point for interactive widgets.
 * COURSE-P2-03 — + `PyCell`, the entry point for runnable Python.
 * COURSE-P5-00 — + `h3`, which Tailwind Preflight had been flattening to body text.
 * COURSE-P5-00 — + `W`, the object-language mark (defined in ./word.tsx).
 * COURSE-P7-01 — + `Leccion`, the cross-lesson reference (defined in ./Leccion.tsx).
 * COURSE-C2-P0-05 — + `RepoLink`, the link to a tagged checkpoint of a companion repository.
 *
 * Passed to `compileMDX` (see src/lib/courses/mdx.ts). Four groups:
 *   1. Element overrides that keep wide content (code, tables, images) from
 *      breaking the page body's horizontal scroll — each scrolls in its OWN box.
 *   2. Four custom block components authors use in MDX.
 *   3. `Explorable` — a Client Component that lazy-loads an interactive widget
 *      (see src/features/courses/widgets). Referencing it from this server map
 *      SSRs its frame and hydrates the widget on the lesson route only (bundle
 *      guard keeps it off shared surfaces).
 *   4. `PyCell` — an async Server Component that Shiki-highlights the author's
 *      Python at build time and hands it to a small client editor. Pyodide itself
 *      loads only on the first Run click; see src/features/courses/code/.
 *   5. `Quiz` and `CodeChallenge` — self-assessment. Unlike everything above they
 *      need data from OUTSIDE the prose (the lesson's frontmatter), so they are NOT
 *      in the static map: use `lessonMdxComponents(quiz, challenges, ctx)` at the
 *      bottom of this file, which binds them to the lesson being compiled.
 *   6. `Leccion` — a cross-lesson reference. Same problem as 5 and the same answer:
 *      it needs to know WHICH lesson it is being compiled into before it can tell a
 *      backward reference from a forward one, so it is bound there too.
 *   7. `RepoLink` — a link OUT of the course to a tagged snapshot of the companion
 *      repository, the terminal-lesson analogue of `ColabLink`. Its only piece of
 *      non-prose data is the request locale (the «checkpoint» kicker is chrome, like
 *      `Leccion`'s card), so it is bound in the same place, from `ctx.locale`.
 *
 * Everything else is a Server Component — `<Details>` uses the native
 * <details>/<summary> element — so lessons ship no client JS for any of it.
 * Styling reuses the global CSS variables from src/app/globals.css.
 */

import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { getTranslations } from "next-intl/server";
// Component-map type via the direct dep; `mdx/types` is a non-hoisted transitive
// under pnpm that TS can't resolve from here.
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { LLM_AGENTS_REPO_BASE } from "@/constants/courses";
import type { CodeChallenge as CodeChallengeData, QuizQuestion } from "@/domain/types";
import { Explorable } from "@/features/courses/widgets/Explorable";
import { CodeChallenge } from "@/features/courses/code/CodeChallenge";
import { EDITOR_MAX_LINES } from "@/features/courses/code/editor-metrics";
import { PyCell } from "@/features/courses/code/PyCell";
import { Quiz } from "@/features/courses/quiz/Quiz";
import { W } from "@/lib/courses/word";

import { makeLeccion, type LeccionCtx } from "./Leccion";

type MDXComponents = NonNullable<MDXRemoteProps["components"]>;

/* ── Element overrides ─────────────────────────────────────────────────── */

// rehype-pretty-code emits <pre><code>…; contain its overflow so a long line
// scrolls inside the block rather than widening the page.
//
// BLOG-02: and so does a long LISTING. `PyCell`'s editor and `CodeOutput` have been
// capped since COURSE-P2-03, but a static fenced block was not, so a 60-line listing
// rendered as a wall between two paragraphs — the same failure editor-metrics.ts
// describes, in the one code box that had escaped it. `EDITOR_MAX_LINES` is imported
// rather than re-typed so "how many lines before it scrolls" stays one number; the
// height is derived HERE because this box inherits the prose line-height (1.75) while
// the editors set their own (1.6), and `em` resolves against each box's own font.
function Pre(props: ComponentPropsWithoutRef<"pre">) {
  return (
    <pre
      {...props}
      style={{
        overflowX: "auto",
        maxWidth: "100%",
        padding: "1rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface-lowest)",
        // 1.75em per line + the 1rem padding top and bottom. `min(…, 70vh)` only
        // bites on short windows, where the absolute value would fill the viewport.
        maxHeight: `min(calc(${EDITOR_MAX_LINES} * 1.75em + 2rem), 70vh)`,
        overflowY: "auto",
        ...props.style,
      }}
    />
  );
}

// Tables can be wider than the column — wrap in a horizontally-scrollable box.
function Table(props: ComponentPropsWithoutRef<"table">) {
  return (
    <div style={{ overflowX: "auto", maxWidth: "100%", margin: "1.5rem 0" }}>
      <table
        {...props}
        style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.95em", ...props.style }}
      />
    </div>
  );
}

// GFM writes column alignment as inline `text-align` on th/td, so spread
// `props.style` LAST to keep it. These add the padding/borders the browser
// default omits, which otherwise leaves columns jammed together.
function Th(props: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      {...props}
      style={{
        padding: "0.5rem 0.85rem",
        borderBottom: "2px solid var(--border-variant)",
        textAlign: "left",
        fontWeight: 600,
        color: "var(--text)",
        ...props.style,
      }}
    />
  );
}

function Td(props: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      {...props}
      style={{
        padding: "0.5rem 0.85rem",
        borderBottom: "1px solid var(--border)",
        color: "var(--text-muted)",
        ...props.style,
      }}
    />
  );
}

function Img(props: ComponentPropsWithoutRef<"img">) {
  // eslint-disable-next-line @next/next/no-img-element -- lesson content is static MDX, not app UI
  return <img {...props} alt={props.alt ?? ""} style={{ maxWidth: "100%", height: "auto", ...props.style }} />;
}

// COURSE-P5-00 — `fontWeight` added for the same reason as `H3` below: Preflight had
// left it at the body's 400, so the lesson h1 (800) dropped straight to a normal-weight
// h2. Without it, adding a properly weighted h3 would have made a SUBSECTION heading
// look bolder than the section containing it.
function H2(props: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      {...props}
      style={{
        marginTop: "2.5rem",
        marginBottom: "1rem",
        fontSize: "1.5rem",
        fontWeight: 700,
        lineHeight: 1.3,
        color: "var(--text)",
        ...props.style,
      }}
    />
  );
}

/*
 * COURSE-P5-00 — h3 was rendering as body text.
 *
 * `globals.css` opens with `@tailwind base`, and Preflight resets EVERY heading to
 * `font-size: inherit; font-weight: inherit`. `h2` escaped that only because it is
 * overridden above; `h3` was never given the same treatment, so a `###` subsection was
 * typographically invisible — a heading the on-this-page rail listed but the page did
 * not show.
 *
 * Sized between `h2` (1.5rem) and the 1.0625rem body, and — unlike `h2` — carrying an
 * explicit weight: at this size, size alone does not read as a heading against 17px
 * prose, and restoring the weight is the cheapest way to make the hierarchy legible.
 * `h4` stays unstyled deliberately: the outline only collects h2/h3 and AUTHORING.md
 * tells authors not to go deeper.
 */
function H3(props: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      style={{
        marginTop: "2rem",
        marginBottom: "0.6rem",
        fontSize: "1.175rem",
        fontWeight: 600,
        lineHeight: 1.4,
        color: "var(--text)",
        ...props.style,
      }}
    />
  );
}

/* ── Custom lesson components ──────────────────────────────────────────── */

type CalloutType = "note" | "warning" | "intuition" | "math";

// Language-neutral accents so the box needs no built-in localized label; an
// author-supplied `title` (already in the lesson's language) renders if given.
const CALLOUT_STYLE: Record<CalloutType, { accent: string; bg: string; icon: string }> = {
  note:      { accent: "var(--border-variant)", bg: "var(--surface-container)", icon: "📝" },
  warning:   { accent: "var(--warning)",        bg: "var(--warning-bg)",        icon: "⚠️" },
  intuition: { accent: "var(--green)",          bg: "var(--green-dim)",         icon: "💡" },
  math:      { accent: "#b794f6",               bg: "rgba(183, 148, 246, 0.12)", icon: "∑" },
};

function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}) {
  const s = CALLOUT_STYLE[type] ?? CALLOUT_STYLE.note;
  return (
    <aside
      style={{
        display: "flex",
        gap: "0.75rem",
        margin: "1.5rem 0",
        padding: "1rem 1.25rem",
        borderLeft: `3px solid ${s.accent}`,
        borderRadius: "var(--radius)",
        background: s.bg,
      }}
    >
      <span aria-hidden style={{ fontSize: "1.1rem", lineHeight: 1.6 }}>
        {s.icon}
      </span>
      <div style={{ minWidth: 0 }}>
        {title ? (
          <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--text)" }}>{title}</p>
        ) : null}
        <div style={{ color: "var(--text-muted)" }}>{children}</div>
      </div>
    </aside>
  );
}

function Figure({ src, alt, caption }: { src: string; alt: string; caption?: string }) {
  return (
    <figure style={{ margin: "1rem 0 1.5rem", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static lesson asset */}
      <img
        src={src}
        alt={alt}
        style={{
          // COURSE-P5-01 — `display: block` + auto margins, not the figure's
          // `text-align: center`. Tailwind Preflight sets `img { display: block }`,
          // and text-align does not centre a block-level child, so the figure was
          // rendering flush left. Same class of Preflight damage as P5-00's prose fix.
          display: "block",
          margin: "0 auto",
          maxWidth: "100%",
          height: "auto",
          borderRadius: "var(--radius)",
        }}
      />
      {caption ? (
        <figcaption style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "var(--text-dim)" }}>
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Details({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details
      style={{
        margin: "1.5rem 0",
        padding: "0.5rem 1rem",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        background: "var(--surface-container)",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--text)" }}>{summary}</summary>
      <div style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}>{children}</div>
    </details>
  );
}

// The pill a link OUT of the course wears — `ColabLink` and `RepoLink` share it so the
// two kinds of "leave the page to do the work elsewhere" look like the same thing, and
// unlike a `<Leccion>`, which stays inside the course (COURSE-C2-P0-05).
const outLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.5rem",
  margin: "1rem 0",
  padding: "0.5rem 1rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--green-mid)",
  background: "var(--green-dim)",
  color: "var(--green)",
  fontWeight: 600,
  textDecoration: "none",
};

// Block 5's escape hatch to GPU work. `notebook` is a Colab URL (or a Colab
// notebook path such as "github/user/repo/blob/main/nb.ipynb").
function ColabLink({ notebook, children }: { notebook: string; children?: ReactNode }) {
  const href = notebook.startsWith("http") ? notebook : `https://colab.research.google.com/${notebook}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={outLinkStyle}>
      <span aria-hidden>▶</span>
      {children ?? "Google Colab"}
    </a>
  );
}

/*
 * COURSE-C2-P0-05 — `<RepoLink tag="…" path?="…">`, the terminal-lesson analogue of
 * `ColabLink`. A Block 5 lesson of `llm-agents` shows its code in fenced blocks and the
 * student types it into a repository on their own machine; what makes that a lesson
 * rather than a blog post is a checkpoint they can clone at every step. The link points
 * at a TAG of the companion repository (`b5-l1` … `b5-l9`, cut from the reviewed lesson
 * at its PR review — the lesson text is the source of truth, the tag is the copy), never
 * at a branch: `main` moves, a tag does not, which is the Colab notebook's "pin a
 * revision" rule carried over. `path` points inside the snapshot.
 *
 * The repository's URL is `LLM_AGENTS_REPO_BASE` and nothing else: an author writes a
 * tag and, at most, a path, so no lesson ever carries the repository's name.
 *
 * The small «punto de control» kicker says it is a snapshot, not the live repository.
 * It is chrome, so it follows the request locale — which is why the component is bound
 * per lesson from `ctx.locale` in `lessonMdxComponents`, like `Leccion`, rather than
 * living in the static map beside `ColabLink`. Server-rendered, no JS.
 */
export interface RepoLinkProps {
  /** A checkpoint tag of the companion repository, e.g. `b5-l3`. */
  tag: string;
  /** A file or directory inside the snapshot, e.g. `herramientas/editar.py`. */
  path?: string;
  /** The label. Omitted, the tag (and the path, when given) stands in. */
  children?: ReactNode;
}

/** The href `<RepoLink>` renders — kept separate so the test can assert it directly. */
export function repoLinkHref(tag: string, path?: string): string {
  return `${LLM_AGENTS_REPO_BASE}/tree/${tag}${path ? `/${path}` : ""}`;
}

export function makeRepoLink(locale: string) {
  return async function RepoLink({ tag, path, children }: RepoLinkProps) {
    const t = await getTranslations({ locale, namespace: "courses.reader.repoLink" });
    return (
      <a href={repoLinkHref(tag, path)} target="_blank" rel="noopener noreferrer" style={outLinkStyle}>
        {/* A git tag, drawn rather than typed: the U+2387 branch glyph falls back to
            tofu on enough phones that a text icon (what `ColabLink`'s ▶ is) would be the
            one part of the pill that does not render everywhere. */}
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 2h6l6 6-6 6-6-6V2z" />
          <circle cx="5.5" cy="5.5" r="1" fill="currentColor" stroke="none" />
        </svg>
        {/* Uppercase is presentation, as in `.lesson-ref-kicker`; the key stays
            sentence case and translatable. */}
        <span
          style={{
            fontSize: "0.7rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
            opacity: 0.85,
          }}
        >
          {t("kicker")}
        </span>
        <span>{children ?? (path ? `${tag} · ${path}` : tag)}</span>
      </a>
    );
  };
}

export const mdxComponents: MDXComponents = {
  pre: Pre,
  table: Table,
  th: Th,
  td: Td,
  img: Img,
  h2: H2,
  h3: H3,
  Callout,
  Figure,
  Details,
  ColabLink,
  Explorable,
  PyCell,
  W,
};

/*
 * COURSE-P3-01 — the per-lesson map.
 * COURSE-P3-02 — + `CodeChallenge`, bound the same way.
 * COURSE-P7-01 — + `Leccion`, and `ctx` forwarded to the two components above, whose
 *                frontmatter copy may reference other lessons as well.
 * COURSE-C2-P0-05 — + `RepoLink`, bound to `ctx.locale` for its kicker (see the
 *                component's comment for why it is not in the static map).
 *
 * `<Quiz id="…" />` carries only an id; the question itself lives in the lesson's
 * frontmatter. A React Server Component has no context to reach it through and the
 * map above is a module-level constant, so the questions are closed over HERE, once
 * per compiled lesson, by `renderLesson` (./mdx.ts).
 *
 * `ctx` is optional so a caller that only wants the prose components (a test, a
 * preview) still gets a working map; without it `<Leccion>` and `<RepoLink>` are simply
 * undefined, which MDX reports as a build error rather than swallowing.
 */
export function lessonMdxComponents(
  quiz: QuizQuestion[],
  challenges: CodeChallengeData[] = [],
  ctx?: LeccionCtx,
): MDXComponents {
  return {
    ...mdxComponents,
    Quiz: ({ id }: { id: string }) => <Quiz id={id} questions={quiz} ctx={ctx} />,
    CodeChallenge: ({ id }: { id: string }) => (
      <CodeChallenge id={id} challenges={challenges} ctx={ctx} />
    ),
    ...(ctx ? { Leccion: makeLeccion(ctx), RepoLink: makeRepoLink(ctx.locale) } : {}),
  };
}
