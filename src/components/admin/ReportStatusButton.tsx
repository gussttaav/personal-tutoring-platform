/**
 * CONTENT-FEEDBACK-01: flips an error report between open and resolved.
 * PATCHes /api/admin/feedback/reports/[id], then refreshes the server-rendered
 * list so the badge re-renders from the source of truth (RetryButton pattern).
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentReportStatus } from "@/domain/types";

interface ReportStatusButtonProps {
  id:     string;
  status: ContentReportStatus;
}

export function ReportStatusButton({ id, status }: ReportStatusButtonProps) {
  const router = useRouter();
  const [state, setState]     = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const next: ContentReportStatus = status === "open" ? "resolved" : "open";

  async function flip() {
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/feedback/reports/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data as { ok?: boolean }).ok) {
        setState("idle");
        router.refresh();
      } else {
        setState("error");
        setMessage((data as { error?: string }).error ?? "Error al actualizar.");
      }
    } catch {
      setState("error");
      setMessage("Error de red.");
    }
  }

  return (
    <div className="cell-stack" style={{ alignItems: "flex-end" }}>
      <button
        onClick={flip}
        disabled={state === "loading"}
        className={`btn-ghost-sm ${state === "loading" ? "is-loading" : ""}`}
      >
        {state === "loading" ? "Guardando…" : next === "resolved" ? "Resolver" : "Reabrir"}
      </button>
      {state === "error" && message && (
        <span className="error-text" style={{ fontSize: 11 }}>
          {message}
        </span>
      )}
    </div>
  );
}
