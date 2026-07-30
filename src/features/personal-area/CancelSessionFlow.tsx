"use client";

/**
 * CancelSessionFlow — the idle → confirm → processing → error machine for
 * cancelling an upcoming booking.
 *
 * Lifted out of the old NextSessionCard so the next-class hero and every row in
 * the "Próximas" tab share one implementation. Before the redesign only the
 * soonest session could be cancelled from this page; the retired weekly calendar
 * had a second, rawer copy of this logic in its context menu.
 *
 * `renderTrigger` keeps the presentation with the caller: the hero wants a full
 * labelled button, an agenda row wants a 38px icon button.
 */

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { camelCaseCode } from "@/constants/errors";

type CancelState = "idle" | "confirm" | "processing" | "error";

interface CancelSessionFlowProps {
  /** The booking's cancel token, as returned by GET /api/my-bookings. */
  token:       string;
  onCancelled: () => void;
  renderTrigger: (open: () => void) => ReactNode;
}

export default function CancelSessionFlow({
  token,
  onCancelled,
  renderTrigger,
}: CancelSessionFlowProps) {
  const t       = useTranslations("areaPersonal.nextSession");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");

  const [state,    setState]    = useState<CancelState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleCancel() {
    setState("processing");
    try {
      const res  = await fetch("/api/cancel", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        const code = data.error;
        setErrorMsg(
          code
            ? tErrors(`domain.${camelCaseCode(code)}` as Parameters<typeof tErrors>[0])
            : tErrors(`http.${res.status}` as Parameters<typeof tErrors>[0]),
        );
        setState("error");
        return;
      }
      onCancelled();
    } catch {
      setErrorMsg(tErrors("http.502"));
      setState("error");
    }
  }

  if (state === "idle") return <>{renderTrigger(() => setState("confirm"))}</>;

  if (state === "processing") {
    return (
      <div className="pa-dots" role="status" aria-live="polite">
        <span /><span /><span />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="pa-confirm" role="alert">
        <p className="pa-confirm__err">{errorMsg}</p>
        <button type="button" className="pa-btn pa-btn--ghost pa-btn--block" onClick={() => setState("idle")}>
          {tCommon("close")}
        </button>
      </div>
    );
  }

  return (
    <div className="pa-confirm">
      <b>{t("cancelConfirmTitle")}</b>
      <p>{t("cancelConfirmBody")}</p>
      <div className="pa-confirm__row">
        <button type="button" className="pa-btn pa-btn--ghost" onClick={() => setState("idle")}>
          {t("keepSession")}
        </button>
        <button type="button" className="pa-btn pa-btn--danger" onClick={handleCancel}>
          {t("confirmCancel")}
        </button>
      </div>
    </div>
  );
}
