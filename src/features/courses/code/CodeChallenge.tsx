/*
 * COURSE-P3-02 — MDX-facing entry point for a code challenge.
 *
 * Authors write `<CodeChallenge id="ch-softmax" />` in the prose; the starter code,
 * the hidden tests, the reference solution and the explanation live in the lesson's
 * frontmatter, where they are schema-validated and linted. `lessonMdxComponents`
 * (src/lib/courses/mdx-components.tsx) binds this component to the challenge list of
 * the lesson being compiled — the same arrangement `<Quiz>` uses, and for the same
 * reason: a Server Component has no context to reach frontmatter through.
 *
 * Async SERVER component. Prompt, explanation and the reference solution are
 * rendered through the lesson's own KaTeX/Shiki pipeline at BUILD time, so a
 * challenge costs the lesson no KaTeX or Shiki JS — the solution is wrapped in a
 * fence so it comes back highlighted like every other Python block in the course.
 *
 * Pyodide is NOT here and must never be. The interpreter is reached only through the
 * `await import()` in `CodeChallengeCard.handleRun`.
 */

import type { CodeChallenge as CodeChallengeData } from "@/domain/types";
import type { LeccionCtx } from "@/lib/courses/Leccion";
import { renderQuizText } from "@/lib/courses/quiz/render";

import { CodeChallengeCard } from "./CodeChallengeCard";

export interface CodeChallengeProps {
  id: string;
  /** The lesson's frontmatter challenges, bound at compile time — not author-supplied. */
  challenges?: CodeChallengeData[];
  /**
   * COURSE-P7-01 — which lesson is being compiled, so a `<Leccion>` in the prompt or the
   * explanation resolves. Server-only: it never reaches the client card.
   */
  ctx?: LeccionCtx;
}

export async function CodeChallenge({ id, challenges = [], ctx }: CodeChallengeProps) {
  const challenge = challenges.find((c) => c.id === id);

  if (!challenge) {
    // Can't reach production: `pnpm lint:content` fails on an unresolved id. In dev
    // we show a visible marker, mirroring `Quiz` and `Explorable`.
    if (process.env.NODE_ENV !== "production") {
      return (
        <p style={{ color: "var(--error)", fontSize: "0.9rem" }}>
          No code challenge with id <code>{id}</code> in this lesson&apos;s frontmatter.
        </p>
      );
    }
    return null;
  }

  const [prompt, explanation, solution] = await Promise.all([
    renderQuizText(challenge.prompt, ctx),
    renderQuizText(challenge.explanation, ctx),
    renderQuizText(`\`\`\`python\n${challenge.solution.trimEnd()}\n\`\`\``, ctx),
  ]);

  return (
    <CodeChallengeCard
      challenge={challenge}
      prompt={prompt}
      explanation={explanation}
      solution={solution}
    />
  );
}

export default CodeChallenge;
