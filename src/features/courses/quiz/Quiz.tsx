/*
 * COURSE-P3-01 — MDX-facing entry point for a quiz question.
 *
 * Authors write `<Quiz id="q-vanishing" />` in the prose; the question itself lives
 * in the lesson's frontmatter, where it can be schema-validated, counted and linted.
 * The two are tied together by `lessonMdxComponents` (src/lib/courses/mdx-components.tsx),
 * which binds this component to the frontmatter list for the lesson being compiled.
 *
 * This is an async SERVER component. It pre-renders every author string — prompt,
 * option labels, explanation, hint, and the `predict-output` snippet — through the
 * lesson's own KaTeX/Shiki pipeline at BUILD time (./../../../lib/courses/quiz/render.tsx)
 * and hands the resulting elements to the client card as props. So a quiz costs the
 * lesson no KaTeX or Shiki JS, exactly like the prose around it.
 *
 * An unknown id can't reach production: `scripts/lint-content.ts` fails on it. In dev
 * we render a visible marker, mirroring `Explorable`.
 */

import type { QuizQuestion } from "@/domain/types";
import type { LeccionCtx } from "@/lib/courses/Leccion";
import { renderQuizInline, renderQuizText } from "@/lib/courses/quiz/render";

import { QuizCard, type RenderedOption } from "./QuizCard";

export interface QuizProps {
  id: string;
  /** The lesson's frontmatter questions, bound at compile time — not author-supplied. */
  questions?: QuizQuestion[];
  /**
   * COURSE-P7-01 — which lesson is being compiled, so a `<Leccion>` in a prompt or an
   * explanation resolves. Bound at compile time like `questions`. Server-only: it never
   * reaches `QuizCard`, which is a Client Component.
   */
  ctx?: LeccionCtx;
}

export async function Quiz({ id, questions = [], ctx }: QuizProps) {
  const question = questions.find((q) => q.id === id);

  if (!question) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <p style={{ color: "var(--error)", fontSize: "0.9rem" }}>
          No quiz question with id <code>{id}</code> in this lesson&apos;s frontmatter.
        </p>
      );
    }
    return null;
  }

  const [prompt, explanation] = await Promise.all([
    renderQuizText(question.prompt, ctx),
    renderQuizText(question.explanation, ctx),
  ]);

  const hint = question.hint ? await renderQuizInline(question.hint, ctx) : null;

  const options: RenderedOption[] =
    question.type === "single" || question.type === "multi"
      ? await Promise.all(
          question.options.map(async (o) => ({
            id: o.id,
            label: await renderQuizInline(o.text, ctx),
          })),
        )
      : [];

  // Wrapped in a fence so the snippet goes through rehype-pretty-code (Shiki) —
  // the same highlighting the lesson's own code blocks get, at build time.
  const code =
    question.type === "predict-output"
      ? await renderQuizText(
          `\`\`\`${question.language ?? "python"}\n${question.code}\n\`\`\``,
          ctx,
        )
      : null;

  return (
    <QuizCard
      question={question}
      prompt={prompt}
      explanation={explanation}
      hint={hint}
      options={options}
      code={code}
    />
  );
}

export default Quiz;
