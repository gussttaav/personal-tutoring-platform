/*
 * COURSE-P3-01 — The interactive half of a quiz question.
 *
 * Presentational and self-contained on purpose: it collects input, grades it with the
 * pure `gradeQuestion`, shows the verdict AND the explanation, and reports the attempt.
 * It stores nothing. P4-02 attaches persistence by wrapping the reader in
 * `QuizAttemptContext.Provider` — it should not need to reopen this file.
 *
 * `onAnswered` arrives through context rather than as a prop because `Quiz` is a
 * Server Component rendered from the MDX component map: a function prop cannot cross
 * that boundary. The default is a no-op, so the quiz works standalone (as it does in
 * this task) and gains persistence later without a change here.
 *
 * All the behaviour worth testing lives in `./state.ts`; this file is wiring and markup.
 */

"use client";

import { createContext, useContext, useEffect, useId, useMemo, useReducer, type ReactElement } from "react";
import { useTranslations } from "next-intl";

import type { QuizQuestion, QuizResult } from "@/domain/types";
import { WidgetButton } from "@/features/courses/widgets/primitives/WidgetButton";

import { canSubmit, createQuizReducer, initialQuizState } from "./state";
import { BooleanChoice } from "./questions/BooleanChoice";
import { MultiChoice } from "./questions/MultiChoice";
import { NumericInput } from "./questions/NumericInput";
import { PredictOutput } from "./questions/PredictOutput";
import { SingleChoice } from "./questions/SingleChoice";

/** An option label, already rendered to KaTeX/markdown at build time. */
export interface RenderedOption {
  id: string;
  label: ReactElement;
}

/** P4-02's wiring point: provide a handler and every attempt on the page reports to it. */
export const QuizAttemptContext = createContext<(result: QuizResult) => void>(() => {});

export interface QuizCardProps {
  question: QuizQuestion;
  prompt: ReactElement;
  explanation: ReactElement;
  hint: ReactElement | null;
  options: RenderedOption[];
  /** Shiki-highlighted snippet, `predict-output` only. */
  code: ReactElement | null;
}

export function QuizCard({ question, prompt, explanation, hint, options, code }: QuizCardProps) {
  const t = useTranslations("courses.quiz");
  const onAnswered = useContext(QuizAttemptContext);

  const reducer = useMemo(() => createQuizReducer(question), [question]);
  const [state, dispatch] = useReducer(reducer, question, initialQuizState);

  const promptId = useId();
  const feedbackId = useId();

  // Every submission produces a NEW result object, so this fires exactly once per
  // attempt — including a retry that lands on the same answer.
  useEffect(() => {
    if (state.result) onAnswered(state.result);
  }, [state.result, onAnswered]);

  const answered = state.result !== null;
  const locked = answered;

  return (
    <section
      style={{
        margin: "2rem 0",
        padding: "1.25rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface-container)",
        // The lesson body must never scroll horizontally: a long KaTeX option scrolls
        // inside its own box instead (same discipline as <Pre>/<Table> in the MDX map).
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div id={promptId} style={{ color: "var(--text)", fontWeight: 600, minWidth: 0 }}>
        {prompt}
      </div>

      <div role="group" aria-labelledby={promptId} style={{ marginTop: "1rem", minWidth: 0 }}>
        {question.type === "single" ? (
          <SingleChoice
            name={promptId}
            options={options}
            selection={typeof state.selection === "string" ? state.selection : null}
            answer={answered ? question.answer : null}
            disabled={locked}
            onSelect={(value) => dispatch({ kind: "select", value })}
          />
        ) : null}

        {question.type === "multi" ? (
          <MultiChoice
            options={options}
            selection={Array.isArray(state.selection) ? state.selection : []}
            answer={answered ? question.answer : null}
            disabled={locked}
            notice={t("multiNotice")}
            onToggle={(optionId) => dispatch({ kind: "toggle", optionId })}
          />
        ) : null}

        {question.type === "boolean" ? (
          <BooleanChoice
            name={promptId}
            selection={typeof state.selection === "boolean" ? state.selection : null}
            disabled={locked}
            trueLabel={t("true")}
            falseLabel={t("false")}
            onSelect={(value) => dispatch({ kind: "select", value })}
          />
        ) : null}

        {question.type === "numeric" ? (
          <NumericInput
            value={typeof state.selection === "number" ? state.selection : null}
            unit={question.unit}
            disabled={locked}
            placeholder={t("numericPlaceholder")}
            toleranceNote={t("toleranceNote", { tolerance: question.tolerance })}
            onChange={(value) => dispatch({ kind: "select", value })}
          />
        ) : null}

        {question.type === "predict-output" ? (
          <PredictOutput
            code={code}
            value={typeof state.selection === "string" ? state.selection : ""}
            disabled={locked}
            label={t("predictPrompt")}
            placeholder={t("outputPlaceholder")}
            onChange={(value) => dispatch({ kind: "select", value })}
          />
        ) : null}
      </div>

      {hint && !answered ? (
        <div style={{ marginTop: "0.9rem" }}>
          {state.hintUsed ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--text-dim)" }}>
              💡 {hint}
            </p>
          ) : (
            <WidgetButton onClick={() => dispatch({ kind: "revealHint" })}>
              {t("showHint")}
            </WidgetButton>
          )}
        </div>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1rem", flexWrap: "wrap" }}>
        {answered ? (
          <WidgetButton onClick={() => dispatch({ kind: "retry" })}>{t("retry")}</WidgetButton>
        ) : (
          <WidgetButton onClick={() => dispatch({ kind: "submit" })} disabled={!canSubmit(state)}>
            {t("submit")}
          </WidgetButton>
        )}
        {state.attempts > 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            {t("attempt", { count: state.attempts })}
          </span>
        ) : null}
      </div>

      {/* The verdict is announced; the explanation that follows it is linked to the
          question group so a screen reader can reach it from the controls. */}
      <div
        id={feedbackId}
        role="status"
        aria-live="polite"
        style={{ marginTop: answered ? "1rem" : 0, minWidth: 0 }}
      >
        {state.result ? (
          <>
            <p
              style={{
                margin: 0,
                fontWeight: 600,
                color: state.result.correct ? "var(--green)" : "var(--error)",
              }}
            >
              {state.result.correct ? `✓ ${t("correct")}` : `✕ ${t("incorrect")}`}
            </p>
            {/* Shown whether right or wrong — the explanation is the teaching. */}
            <div
              style={{
                marginTop: "0.6rem",
                padding: "0.85rem 1rem",
                borderRadius: "var(--radius)",
                borderLeft: "3px solid var(--border-variant)",
                background: "var(--surface-lowest)",
                color: "var(--text-muted)",
                fontSize: "0.925rem",
                minWidth: 0,
              }}
            >
              <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--text)" }}>
                {t("explanationLabel")}
              </p>
              {explanation}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default QuizCard;
