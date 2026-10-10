/**
 * BLOG-15 — the last step before an announcement email goes out, for courses and the blog.
 *
 * It names the total the send will reach, read fresh when the dialog opens (the parent
 * refreshes the live count as it mounts this), and how much of it this chunk covers. The
 * «escribe ENVIAR» guard that used to sit under the preview lives here now, so there is one
 * deliberate confirmation rather than two. Every chunk opens it again.
 *
 * A native <dialog> opened with showModal(): the browser supplies the focus trap, the inert
 * page behind it and Escape (routed to `onClose`, and ignored mid-send). The parent mounts it
 * only while open, so the typed word starts empty every time. Admin panel is Spanish.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { CountState } from "./useRecipientCount";

const CONFIRM_WORD = "ENVIAR";

const people = (n: number) => (n === 1 ? "persona" : "personas");

export function ConfirmSendDialog({
  count,
  subject,
  sending,
  onConfirm,
  onClose,
}: {
  count:     CountState;
  /** What is being announced, e.g. «Árboles B» or «Lanzamiento · Deep Learning para NLP». */
  subject:   string;
  sending:   boolean;
  onConfirm: () => void;
  onClose:   () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [word, setWord] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  const data   = count.status === "ready" ? count.data : null;
  const total  = data?.pending ?? 0;
  const batch  = data?.wouldSendNow ?? 0;
  const armed  = word.trim().toUpperCase() === CONFIRM_WORD;
  const canSend = armed && batch > 0 && !sending;

  function submit() {
    if (canSend) onConfirm();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-send-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!sending) onClose();
      }}
    >
      <div className="confirm-dialog-head">
        <span className="material-symbols-outlined" aria-hidden="true">send</span>
        <h2 id="confirm-send-title">Confirmar envío</h2>
      </div>
      <p className="confirm-dialog-subject">{subject}</p>

      <div className="confirm-dialog-count" role="status">
        {count.status === "loading" || count.status === "idle" ? (
          <p>Calculando destinatarios…</p>
        ) : count.status === "error" ? (
          <p className="error-text">No se pudo calcular el número de destinatarios. Cierra y vuelve a intentarlo.</p>
        ) : total === 0 ? (
          <p>Ya no queda nadie por avisar.</p>
        ) : (
          <>
            <p>
              Vas a enviar este correo a <strong className="confirm-dialog-total">{total}</strong>{" "}
              {people(total)}.
            </p>
            {batch < total && (
              <p className="confirm-dialog-note">
                Se envía por tandas: {batch} ahora y {total - batch} después. Cada tanda se confirma
                otra vez.
              </p>
            )}
          </>
        )}
      </div>

      <p className="announce-warn">
        <span className="material-symbols-outlined" aria-hidden="true">warning</span>
        Es correo real y no se puede deshacer.
      </p>

      <label className="confirm-dialog-label">
        <span>Escribe {CONFIRM_WORD} para confirmar</span>
        <input
          className="adjust-reason"
          type="text"
          value={word}
          autoComplete="off"
          autoFocus
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
        />
      </label>

      <div className="confirm-dialog-actions">
        <button type="button" className="btn-ghost" onClick={onClose} disabled={sending}>
          Cancelar
        </button>
        <button type="button" className="btn-primary" onClick={submit} disabled={!canSend}>
          {sending ? "Enviando…" : `Enviar a ${batch} ${people(batch)}`}
        </button>
      </div>
    </dialog>
  );
}
