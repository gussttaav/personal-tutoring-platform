"use client";

/*
 * COURSE-P9-01 — Render text with the matched ranges wrapped in <mark>.
 *
 * Takes OFFSETS, never an HTML string. That is the whole reason `snippet.ts` returns
 * ranges: this feature has no `dangerouslySetInnerHTML` anywhere, so author-written MDX
 * prose can never become markup on the way to the result list.
 */

import { Fragment } from "react";
import { splitByMarks } from "@/lib/courses/search/snippet";
import type { Range } from "@/lib/courses/search/match";

export default function HighlightedText({ text, ranges }: { text: string; ranges: Range[] }) {
  return (
    <>
      {splitByMarks(text, ranges).map((run, i) => (
        <Fragment key={i}>{run.mark ? <mark>{run.text}</mark> : run.text}</Fragment>
      ))}
    </>
  );
}
