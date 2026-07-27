/*
 * COURSE-P1-01 — MDX → React component map for course lessons.
 * COURSE-P2-01 — + `Explorable`, the entry point for interactive widgets.
 *
 * Passed to `compileMDX` (see src/lib/courses/mdx.ts). Three groups:
 *   1. Element overrides that keep wide content (code, tables, images) from
 *      breaking the page body's horizontal scroll — each scrolls in its OWN box.
 *   2. Four custom block components authors use in MDX.
 *   3. `Explorable` — a Client Component that lazy-loads an interactive widget
 *      (see src/features/courses/widgets). It is the only client component here;
 *      referencing it from this server map SSRs its frame and hydrates the widget
 *      on the lesson route only (bundle guard keeps it off shared surfaces).
 *
 * Everything else is a Server Component — `<Details>` uses the native
 * <details>/<summary> element — so lessons ship no client JS for any of it.
 * Styling reuses the global CSS variables from src/app/globals.css.
 */

import type { ComponentPropsWithoutRef, ReactNode } from "react";
// Component-map type via the direct dep; `mdx/types` is a non-hoisted transitive
// under pnpm that TS can't resolve from here.
import type { MDXRemoteProps } from "next-mdx-remote/rsc";

import { Explorable } from "@/features/courses/widgets/Explorable";

type MDXComponents = NonNullable<MDXRemoteProps["components"]>;

/* ── Element overrides ─────────────────────────────────────────────────── */

// rehype-pretty-code emits <pre><code>…; contain its overflow so a long line
// scrolls inside the block rather than widening the page.
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

function H2(props: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      {...props}
      style={{
        marginTop: "2.5rem",
        marginBottom: "1rem",
        fontSize: "1.5rem",
        lineHeight: 1.3,
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
    <figure style={{ margin: "1.5rem 0", textAlign: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- static lesson asset */}
      <img src={src} alt={alt} style={{ maxWidth: "100%", height: "auto", borderRadius: "var(--radius)" }} />
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

// Block 4's escape hatch to GPU work. `notebook` is a Colab URL (or a Colab
// notebook path such as "github/user/repo/blob/main/nb.ipynb").
function ColabLink({ notebook, children }: { notebook: string; children?: ReactNode }) {
  const href = notebook.startsWith("http") ? notebook : `https://colab.research.google.com/${notebook}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
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
      }}
    >
      <span aria-hidden>▶</span>
      {children ?? "Google Colab"}
    </a>
  );
}

export const mdxComponents: MDXComponents = {
  pre: Pre,
  table: Table,
  th: Th,
  td: Td,
  img: Img,
  h2: H2,
  Callout,
  Figure,
  Details,
  ColabLink,
  Explorable,
};
