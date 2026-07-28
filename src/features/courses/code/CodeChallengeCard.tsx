/*
 * COURSE-P3-02 — The interactive half of a code challenge.
 *
 * Two halves of two earlier tasks, joined:
 *   - the RUN mechanics come from `PyCellClient` (P2-03) — the load gate, the
 *     streamed output, `client.reset()` as Stop, the retained shared interpreter;
 *   - the ASSESSMENT mechanics come from `QuizCard` (P3-01) — a pure reducer, a
 *     context-provided `onAnswered`, one result object per attempt.
 *
 * THE LOAD GATE IS THE `await import()` IN `handleRun`, exactly as in PyCellClient,
 * and it now covers `run-tests.ts` too: that module is pure strings, but it lives
 * under `lib/courses/pyodide/` and `scripts/check-bundle.ts` forbids the substring
 * "pyodide" in EVERY route's first-load JS. Do not hoist either import.
 *
 * FEEDBACK QUALITY IS THE POINT. A bare "AssertionError" teaches nothing, so each
 * test reports independently with its author-given name, and a test that raised
 * something other than an AssertionError (a NameError, a TypeError) is presented as
 * a different kind of problem — not as a wrong answer. The full traceback stays one
 * click away rather than in the student's face.
 *
 * Unlike the P2-01/P2-03 widget layer, every string here goes through `t()`: a
 * challenge is assessment, and P3-01 established that assessment copy is translated.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { useTranslations } from "next-intl";

import type { ChallengeResult, CodeChallenge, TestResult } from "@/domain/types";
import { WidgetButton } from "@/features/courses/widgets/primitives/WidgetButton";
// Type-only — erased at build, so nothing under `lib/courses/pyodide/` reaches the
// lesson's first-load chunk.
import type { LoadStage, RunResult } from "@/lib/courses/pyodide/client";

import {
  canRevealSolution,
  createChallengeReducer,
  failuresUntilReveal,
  initialChallengeState,
} from "./challenge-state";
import { applyAutoClose, applyBackspacePair, applyEnter, applyTab } from "./editing";

/** P4-02's wiring point, twinned with `QuizAttemptContext`: provide a handler and
 *  every graded run on the page reports to it. Both take an `AssessmentResult`. */
export const ChallengeAttemptContext = createContext<(result: ChallengeResult) => void>(() => {});

export interface CodeChallengeCardProps {
  challenge: CodeChallenge;
  prompt: ReactElement;
  explanation: ReactElement;
  /** The reference solution, Shiki-highlighted at build time. */
  solution: ReactElement;
}

type Status = "idle" | "loading" | "running";

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const STATUS_ICON: Record<TestResult["status"], string> = {
  pass:      "✓",
  fail:      "✕",
  error:     "!",
  "not-run": "·",
};

const STATUS_KEY: Record<TestResult["status"], string> = {
  pass:      "status.pass",
  fail:      "status.fail",
  error:     "status.error",
  "not-run": "status.notRun",
};

const STATUS_COLOR: Record<TestResult["status"], string> = {
  pass:      "var(--green)",
  fail:      "var(--error)",
  error:     "var(--warning)",
  "not-run": "var(--text-dim)",
};

export function CodeChallengeCard({
  challenge,
  prompt,
  explanation,
  solution,
}: CodeChallengeCardProps) {
  const t = useTranslations("courses.challenge");
  const onAnswered = useContext(ChallengeAttemptContext);

  const reducer = useMemo(() => createChallengeReducer(challenge.id), [challenge.id]);
  const [state, dispatch] = useReducer(reducer, undefined, initialChallengeState);

  const [value, setValue] = useState(challenge.starter);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<{ stage: LoadStage; pct: number; detail?: string } | null>(
    null,
  );
  const [stdout, setStdout] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const textarea = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<[number, number] | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const release = useRef<(() => void) | null>(null);

  const promptId = useId();
  const busy = status !== "idle";

  const STAGE_LABEL: Record<LoadStage, string> = {
    runtime:  t("stage.runtime"),
    packages: t("stage.packages"),
    preamble: t("stage.preamble"),
    ready:    t("stage.ready"),
  };

  // Release this challenge's claim on the shared interpreter. Only ever set if it
  // actually ran, so an untouched challenge never loads the Pyodide module graph.
  useEffect(() => () => release.current?.(), []);

  // Restore the caret after a helper-driven edit (setState resets it to the end).
  useEffect(() => {
    const selection = pendingSelection.current;
    if (selection && textarea.current) {
      textarea.current.setSelectionRange(selection[0], selection[1]);
      pendingSelection.current = null;
    }
  });

  // A new result object per graded run, so this fires exactly once per attempt.
  useEffect(() => {
    if (state.result) onAnswered(state.result);
  }, [state.result, onAnswered]);

  const handleRun = useCallback(async () => {
    setNotice(null);
    setStdout("");
    setStatus("loading");
    setProgress({ stage: "runtime", pct: 0 });

    // ── The load gate. Everything under lib/courses/pyodide/ is behind this line. ──
    const [{ getPyodideClient, retainPyodide }, { buildTestProgram, parseTestOutput }] =
      await Promise.all([
        import("@/lib/courses/pyodide/spawn"),
        import("@/lib/courses/pyodide/run-tests"),
      ]);
    if (!release.current) release.current = retainPyodide();

    const client = getPyodideClient();
    stop.current = () => client.reset();

    let out = "";
    let err = "";
    const result: RunResult = await client.run(
      buildTestProgram(value, challenge.tests),
      challenge.packages ?? [],
      {
        onLoading: (stage, pct, detail) => {
          setProgress({ stage, pct, detail });
          if (stage === "ready") setStatus("running");
        },
        // stdout carries the harness protocol AND the student's prints; stderr is
        // theirs alone. Kept apart so an interleaved stderr write can never split a
        // result line down the middle.
        onOutput: (stream, text) => {
          if (stream === "stdout") out += text;
          else err += text;
        },
      },
    );

    setStatus("idle");
    setProgress(null);
    stop.current = null;

    // Which failures still count as an attempt: a run that EXECUTED, however badly.
    // A load timeout is a slow network, a crash is the device giving up and Stop is
    // the student's own choice — none of those say anything about their code, so
    // none of them burns an attempt or unlocks the solution.
    let graded = result.ok;
    if (!result.ok) {
      switch (result.kind) {
        case "python":
          // The generated wrapper itself raised. Student errors are caught inside it,
          // so this is a harness bug — surface it rather than showing nothing.
          graded = true;
          break;
        case "timeout":
          graded = result.phase === "run";
          setNotice(
            result.phase === "run"
              ? t("timeoutRun", { seconds: Math.round(result.ms / 1000) })
              : t("timeoutLoad"),
          );
          break;
        case "stopped":
          setNotice(t("stopped"));
          break;
        case "crashed":
          setNotice(t("crashed", { error: result.error }));
          break;
      }
    }

    const outcome = parseTestOutput(out, challenge.tests);
    setStdout([outcome.stdout, err].filter(Boolean).join("\n"));

    if (graded) {
      dispatch({
        kind: "graded",
        outcome:
          outcome.studentError === null && !result.ok && result.kind === "python"
            ? { ...outcome, studentError: result.error }
            : outcome,
      });
    }
  }, [challenge.packages, challenge.tests, t, value]);

  const handleReset = useCallback(() => {
    setValue(challenge.starter);
    setStdout("");
    setNotice(null);
    dispatch({ kind: "reset" });
  }, [challenge.starter]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const editState = {
      value: element.value,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
    };

    const edit =
      event.key === "Tab"
        ? applyTab(editState, event.shiftKey)
        : event.key === "Enter"
          ? applyEnter(editState)
          : event.key === "Backspace"
            ? applyBackspacePair(editState)
            : event.key.length === 1
              ? applyAutoClose(editState, event.key)
              : null;

    if (!edit) return;
    event.preventDefault();
    pendingSelection.current = [edit.selectionStart, edit.selectionEnd];
    setValue(edit.value);
  }, []);

  const outcome = state.outcome;
  const passed = outcome ? outcome.tests.filter((test) => test.status === "pass").length : 0;
  const revealable = canRevealSolution(state);
  const remaining = failuresUntilReveal(state);

  return (
    <section
      style={{
        margin: "2rem 0",
        padding: "1.25rem",
        borderRadius: "var(--radius)",
        border: "1px solid var(--border)",
        background: "var(--surface-container)",
        // Nothing here may widen the lesson body — same discipline as QuizCard.
        minWidth: 0,
        maxWidth: "100%",
      }}
    >
      <div id={promptId} style={{ color: "var(--text)", fontWeight: 600, minWidth: 0 }}>
        {prompt}
      </div>

      <textarea
        ref={textarea}
        value={value}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label={t("editorLabel")}
        aria-describedby={promptId}
        rows={value.split("\n").length + 1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          display: "block",
          width: "100%",
          margin: "1rem 0 0",
          padding: "0.85rem 1rem",
          minHeight: "6rem",
          resize: "vertical",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          background: "var(--surface-lowest)",
          color: "var(--text)",
          fontFamily: mono,
          fontSize: "0.85rem",
          lineHeight: 1.6,
          tabSize: 4,
          // In Python, indentation is syntax: never wrap or collapse it.
          whiteSpace: "pre",
          overflowWrap: "normal",
          overflowX: "auto",
        }}
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "0.6rem",
        }}
      >
        <WidgetButton onClick={handleRun} disabled={busy} style={{ minWidth: "6.5rem" }}>
          {busy ? t("running") : t("run")}
        </WidgetButton>
        {busy ? <WidgetButton onClick={() => stop.current?.()}>{t("stop")}</WidgetButton> : null}
        <WidgetButton onClick={handleReset} disabled={busy}>
          {t("reset")}
        </WidgetButton>
        {state.attempts > 0 ? (
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)" }}>
            {t("attempt", { count: state.attempts })}
          </span>
        ) : null}
      </div>

      <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "var(--text-dim)" }}>
        {state.attempts === 0 && !busy ? `${t("firstRunNote")} ` : ""}
        {t("keyboardNote")}
      </p>

      {progress ? (
        <div style={{ marginTop: "0.6rem" }}>
          <div
            role="progressbar"
            aria-valuenow={progress.pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={STAGE_LABEL[progress.stage]}
            style={{
              height: 4,
              borderRadius: 999,
              background: "var(--surface-low)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progress.pct}%`,
                height: "100%",
                background: "var(--green)",
                transition: "width 240ms linear",
              }}
            />
          </div>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--text-dim)" }}>
            {STAGE_LABEL[progress.stage]}
            {progress.detail ? ` ${progress.detail}` : ""}
          </p>
        </div>
      ) : null}

      {notice ? (
        <p
          role="status"
          style={{
            margin: "0.75rem 0 0",
            padding: "0.6rem 0.8rem",
            borderRadius: "var(--radius)",
            border: "1px solid var(--warning)",
            background: "var(--warning-bg)",
            color: "var(--text)",
            fontSize: "0.85rem",
          }}
        >
          {notice}
        </p>
      ) : null}

      {stdout ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.78rem", color: "var(--text-dim)" }}>
            {t("outputLabel")}
          </p>
          <pre style={outputBox}>{stdout}</pre>
        </div>
      ) : null}

      {/* The verdict is announced; everything below it is the teaching. */}
      <div role="status" aria-live="polite" style={{ minWidth: 0 }}>
        {outcome ? (
          <>
            {outcome.studentError ? (
              <div style={{ marginTop: "1rem" }}>
                <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--error)" }}>
                  {t("studentErrorTitle")}
                </p>
                <pre style={{ ...outputBox, borderColor: "var(--error)", color: "var(--error)" }}>
                  {outcome.studentError}
                </pre>
              </div>
            ) : null}

            <p
              style={{
                margin: "1rem 0 0.5rem",
                fontWeight: 600,
                color: passed === outcome.tests.length ? "var(--green)" : "var(--text)",
              }}
            >
              {passed === outcome.tests.length
                ? `✓ ${t("allPassed")}`
                : t("score", { passed, total: outcome.tests.length })}
            </p>

            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}>
              {outcome.tests.map((test) => (
                <TestRow key={test.name} test={test} t={t} />
              ))}
            </ul>
          </>
        ) : null}
      </div>

      {state.solved || state.solutionRevealed ? (
        <div
          style={{
            marginTop: "1rem",
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
      ) : null}

      <div style={{ marginTop: "1rem" }}>
        {state.solutionRevealed ? (
          <>
            <p style={{ margin: "0 0 0.35rem", fontWeight: 600, color: "var(--text)" }}>
              {t("solutionLabel")}
            </p>
            <div style={{ minWidth: 0, maxWidth: "100%" }}>{solution}</div>
          </>
        ) : revealable ? (
          <WidgetButton onClick={() => dispatch({ kind: "revealSolution" })}>
            {t("showSolution")}
          </WidgetButton>
        ) : state.attempts > 0 ? (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-dim)" }}>
            {t("lockedNote", { count: remaining })}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const outputBox = {
  margin: 0,
  padding: "0.75rem 0.9rem",
  maxHeight: 320,
  overflow: "auto",
  maxWidth: "100%",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface-lowest)",
  color: "var(--text-muted)",
  fontFamily: mono,
  fontSize: "0.82rem",
  lineHeight: 1.55,
  whiteSpace: "pre" as const,
};

/**
 * One test's verdict. A failure shows the author's assertion message when there is
 * one; an ERROR shows the exception line, because `NameError: name 'softmax' is not
 * defined` is a different message to the student than "your answer is wrong". The
 * traceback is available but folded away.
 */
function TestRow({ test, t }: { test: TestResult; t: (key: string) => string }) {
  const detail =
    test.status === "fail"
      ? (test.message ?? "") || t("assertionFailed")
      : test.status === "error"
        ? test.message
        : test.status === "not-run"
          ? t("notRunNote")
          : null;

  return (
    <li style={{ display: "flex", gap: "0.6rem", alignItems: "baseline", minWidth: 0 }}>
      {/* The icon carries the verdict for sighted readers and its label for the rest —
          colour alone must never be the signal. */}
      <span
        role="img"
        aria-label={t(STATUS_KEY[test.status])}
        style={{ color: STATUS_COLOR[test.status], fontWeight: 700 }}
      >
        {STATUS_ICON[test.status]}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <span style={{ color: "var(--text)", fontSize: "0.9rem" }}>{test.name}</span>
        {detail ? (
          <p
            style={{
              margin: "0.2rem 0 0",
              fontSize: "0.82rem",
              color: STATUS_COLOR[test.status],
              fontFamily: test.status === "error" ? mono : undefined,
              overflowWrap: "anywhere",
            }}
          >
            {detail}
          </p>
        ) : null}
        {test.traceback ? (
          <details style={{ marginTop: "0.3rem" }}>
            <summary style={{ cursor: "pointer", fontSize: "0.78rem", color: "var(--text-dim)" }}>
              {t("tracebackLabel")}
            </summary>
            <pre style={{ ...outputBox, marginTop: "0.35rem" }}>{test.traceback}</pre>
          </details>
        ) : null}
      </div>
    </li>
  );
}

export default CodeChallengeCard;
