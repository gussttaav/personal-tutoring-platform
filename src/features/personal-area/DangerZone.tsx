"use client";

/**
 * ACCOUNT-DELETE-01: DangerZone — the account-deletion surface of the personal area.
 *
 * Collapsed by default: this is the one irreversible action on the page, so it does
 * not compete for attention with booking a class. Opening it fetches the server's
 * eligibility verdict and renders one of three states — deletion is gated, and the
 * two blocked states are remedies, not error messages, so each carries the action
 * that unblocks it.
 *
 * On success the component signs the user out immediately. That is load-bearing,
 * not cosmetic: the NextAuth cookie outlives the deleted account (it is decoded,
 * never checked against the users table) and several services call ensureUser(),
 * which upserts — so a client that keeps browsing would recreate an empty row.
 */

import { useCallback, useState } from "react";
import { signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api-client";
import { errorCodeToKey } from "@/constants/errors";
import type { DeletionEligibility } from "@/domain/types";

const CONTACT_EMAIL = "contacto@gustavoai.dev";

interface DangerZoneProps {
  /** The signed-in user's email — what must be typed back to confirm. */
  email: string;
  /** Sends the student to the upcoming-classes tab, where he can cancel them. */
  onGoToUpcoming: () => void;
}

type Status = "closed" | "loading" | "ready" | "loadError" | "deleting";

export default function DangerZone({ email, onGoToUpcoming }: DangerZoneProps) {
  const t       = useTranslations("areaPersonal.dangerZone");
  const tErrors = useTranslations("errors");

  const [status,      setStatus]      = useState<Status>("closed");
  const [eligibility, setEligibility] = useState<DeletionEligibility | null>(null);
  const [typed,       setTyped]       = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");

  const load = useCallback(async () => {
    setStatus("loading");
    setErrorMsg("");
    try {
      setEligibility(await api.account.eligibility());
      setStatus("ready");
    } catch {
      setStatus("loadError");
    }
  }, []);

  function close() {
    setStatus("closed");
    setEligibility(null);
    setTyped("");
    setErrorMsg("");
  }

  async function handleDelete() {
    setStatus("deleting");
    setErrorMsg("");
    try {
      await api.account.delete(typed.trim());
      // Discard the credential before anything else can use it.
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      const code   = err instanceof ApiError ? err.code   : undefined;
      setErrorMsg(tErrors(errorCodeToKey(code, status) as Parameters<typeof tErrors>[0]));
      // A 409 means the account state changed under us — re-read the verdict so
      // the user sees the remedy rather than a dead confirmation form.
      if (status === 409) await load();
      else setStatus("ready");
    }
  }

  if (status === "closed") {
    return (
      <section className="pa-danger">
        <div className="pa-danger__head">
          <div>
            <h2>{t("title")}</h2>
            <p>{t("intro")}</p>
          </div>
          <button type="button" className="pa-btn pa-btn--danger" onClick={load}>
            {t("trigger")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="pa-danger pa-danger--open">
      <div className="pa-danger__head">
        <div>
          <h2>{t("title")}</h2>
          <p>{t("intro")}</p>
        </div>
        <button type="button" className="pa-btn pa-btn--ghost" onClick={close}>
          {t("close")}
        </button>
      </div>

      {(status === "loading" || status === "deleting") && (
        <div className="pa-danger__body">
          <div className="pa-dots" role="status" aria-live="polite">
            <span /><span /><span />
          </div>
          {status === "deleting" && <p className="pa-danger__note">{t("deleting")}</p>}
        </div>
      )}

      {status === "loadError" && (
        <div className="pa-danger__body" role="alert">
          <p className="pa-danger__note">{t("loadError")}</p>
          <button type="button" className="pa-btn pa-btn--ghost" onClick={load}>
            {t("retry")}
          </button>
        </div>
      )}

      {status === "ready" && eligibility && (
        <div className="pa-danger__body">
          {errorMsg && <p className="pa-confirm__err" role="alert">{errorMsg}</p>}

          {eligibility.reason === "CANCELLABLE_BOOKINGS" && (
            <>
              <b>{t("blockedBookings.title")}</b>
              <p>{t("blockedBookings.body", { count: eligibility.cancellableBookings })}</p>
              <p className="pa-danger__note">{t("blockedBookings.packNote")}</p>
              <button type="button" className="pa-btn pa-btn--primary" onClick={onGoToUpcoming}>
                {t("blockedBookings.action")}
              </button>
            </>
          )}

          {eligibility.reason === "ACTIVE_PACK_CREDITS" && (
            <>
              <b>{t("blockedPack.title")}</b>
              <p>{t("blockedPack.body", { count: eligibility.packCredits })}</p>
              <div className="pa-danger__row">
                <a className="pa-btn pa-btn--primary" href={`mailto:${CONTACT_EMAIL}`}>
                  {t("blockedPack.action")}
                </a>
                <Link className="pa-btn pa-btn--ghost" href="/terminos">
                  {t("blockedPack.terms")}
                </Link>
              </div>
            </>
          )}

          {eligibility.eligible && (
            <>
              <b>{t("confirm.title")}</b>
              <p>{t("confirm.body")}</p>
              <ul className="pa-danger__list">
                <li>{t("confirm.item1")}</li>
                <li>{t("confirm.item2")}</li>
                <li>{t("confirm.item3")}</li>
                <li>{t("confirm.item4")}</li>
              </ul>
              {eligibility.imminentBookings > 0 && (
                <p className="pa-danger__warn">
                  {t("confirm.imminent", { count: eligibility.imminentBookings })}
                </p>
              )}

              <label className="pa-danger__label" htmlFor="pa-danger-confirm">
                {t("confirm.typeEmail", { email })}
              </label>
              <input
                id="pa-danger-confirm"
                className="pa-danger__input"
                type="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={t("confirm.placeholder")}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />

              <div className="pa-danger__row">
                <button type="button" className="pa-btn pa-btn--ghost" onClick={close}>
                  {t("confirm.cancel")}
                </button>
                <button
                  type="button"
                  className="pa-btn pa-btn--danger"
                  disabled={typed.trim().toLowerCase() !== email.toLowerCase()}
                  onClick={handleDelete}
                >
                  {t("confirm.submit")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
