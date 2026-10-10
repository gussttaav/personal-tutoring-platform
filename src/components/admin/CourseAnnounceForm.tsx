/**
 * COURSE-P6-02b — the send screen for course announcements. Admin panel is Spanish.
 *
 * This is the only control in the panel whose effect cannot be undone, so the flow is
 * deliberately slower than it needs to be:
 *
 *   1. pick a type and a course        →  nothing has happened yet
 *   2. Previsualizar (dry run)         →  reads the real rendered email, in both languages
 *   3. type ENVIAR, then send          →  and again for every chunk after the first
 *
 * Step 2 is mandatory: `confirm: true` is only ever attached to a body that a dry run has
 * already returned, and touching any field throws the preview away and re-locks the button.
 * The server enforces the same asymmetry independently — a POST without `confirm` cannot
 * send — so this component is the second lock, not the only one.
 *
 * BLOG-15: how many people the email reaches is the first thing on screen, not the last. The
 * live count (`useRecipientCount`, a count-only POST) follows the course, the kind and the key
 * from the moment they are picked, before any preview, and «Enviar» opens a dialog that
 * names the total — read fresh as it opens — with the ENVIAR guard inside it. The samples
 * frame and the dialog are shared with the blog form.
 */
"use client";

import { useState } from "react";
import type { AnnouncementKind } from "@/domain/types";
import { AnnounceSamples, type AnnounceSample } from "./AnnounceSamples";
import { ConfirmSendDialog } from "./ConfirmSendDialog";
import { RecipientCount } from "./RecipientCount";
import { useRecipientCount } from "./useRecipientCount";

interface CourseOption {
  slug:  string;
  title: string;
}

interface DryRun {
  dryRun:          true;
  kind:            AnnouncementKind;
  announcementKey: string;
  subscribers:     number;
  alreadyNotified: number;
  pending:         number;
  wouldSendNow:    number;
  byLocale:        { es: number; en: number };
  translation:     { translated: number; total: number; fullyTranslated: boolean };
  samples:         Partial<Record<"es" | "en", AnnounceSample>>;
}

interface SendResult {
  dryRun:     false;
  sent:       number;
  failed:     number;
  failedTo:   string[];
  remaining:  number;
  nextOffset: number;
}

const KINDS: { value: AnnouncementKind; label: string; hint: string }[] = [
  { value: "launch",  label: "Lanzamiento",
    hint: "El curso acaba de publicarse. Se envía una sola vez." },
  { value: "english", label: "Versión en inglés",
    hint: "La traducción al inglés ya está disponible. Se envía una sola vez." },
  { value: "update",  label: "Actualización",
    hint: "Has revisado a fondo un curso publicado. Se puede enviar tantas veces como haga falta." },
];

const ENDPOINT      = "/api/admin/course-announce";
const MAX_WHATS_NEW = 300;

/** What the server will default the key to for an update, mirrored here so the operator can
 *  read it before previewing. The confirmed send always uses the key the DRY RUN returned,
 *  never this — so a date that rolls over between the two cannot split the announcement. */
function defaultUpdateKey(slug: string): string {
  return `update:${slug}:${new Date().toISOString().slice(0, 10)}`;
}

export function CourseAnnounceForm({ courses }: { courses: CourseOption[] }) {
  const [courseSlug, setCourseSlug] = useState(courses[0]?.slug ?? "");
  const [kind, setKind]             = useState<AnnouncementKind>("launch");
  const [whatsNew, setWhatsNew]     = useState("");
  const [keyOverride, setKeyOverride] = useState("");

  const [preview, setPreview]       = useState<DryRun | null>(null);
  const [totals, setTotals]         = useState({ sent: 0, failed: 0, failedTo: [] as string[] });
  const [chunks, setChunks]         = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // The live count. Once previewed, it counts against the key the dry run resolved — the one
  // the send will use — so the dialog's total is about exactly that announcement.
  const countKey = preview?.announcementKey
    ?? (kind === "update" && keyOverride.trim() ? keyOverride.trim() : undefined);
  const { count, refresh: refreshCount } = useRecipientCount(
    ENDPOINT,
    courseSlug ? { courseSlug, kind, ...(countKey ? { announcementKey: countKey } : {}) } : null,
  );

  /** Any edit invalidates everything downstream of it. A preview that no longer describes
   *  the form is worse than no preview at all. */
  function reset() {
    setPreview(null);
    setTotals({ sent: 0, failed: 0, failedTo: [] });
    setChunks(0);
    setConfirmOpen(false);
    setError(null);
  }

  function edit<T>(setter: (value: T) => void) {
    return (value: T) => { setter(value); reset(); };
  }

  const resolvedKey = preview?.announcementKey
    ?? (kind === "update" ? (keyOverride.trim() || defaultUpdateKey(courseSlug)) : null);

  /** The body every request in this flow is built from — preview and send send the same one. */
  function requestBody() {
    return {
      courseSlug,
      kind,
      ...(kind === "update" ? { whatsNew: whatsNew.trim() } : {}),
      ...(kind === "update" && keyOverride.trim()
        ? { announcementKey: keyOverride.trim() }
        : {}),
    };
  }

  async function post(body: Record<string, unknown>): Promise<unknown | null> {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(ENDPOINT, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Error al contactar con el servidor.");
        return null;
      }
      return data;
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function runPreview() {
    if (!courseSlug) { setError("Elige un curso."); return; }
    if (kind === "update" && !whatsNew.trim()) {
      setError("La novedad es obligatoria para una actualización.");
      return;
    }
    reset();
    const data = await post(requestBody());
    if (data) setPreview(data as DryRun);
  }

  function openConfirm() {
    // Read the total again as the dialog opens: it is the number the operator confirms.
    refreshCount();
    setConfirmOpen(true);
  }

  async function runSend() {
    if (!preview) return;
    const data = await post({
      ...requestBody(),
      // The key the dry run resolved, not a freshly computed one.
      announcementKey: preview.announcementKey,
      confirm:         true,
      // Deliberately NOT `nextOffset`: `offset` indexes into the list of people who have not
      // been notified yet, and the chunk just sent removed itself from that list. Resuming at
      // 0 is what reaches the next slice; resuming at nextOffset steps over it.
      offset:          0,
    });
    if (!data) return;

    const result = data as SendResult;
    setTotals((t) => ({
      sent:     t.sent + result.sent,
      failed:   t.failed + result.failed,
      failedTo: [...t.failedTo, ...result.failedTo],
    }));
    setChunks((n) => n + 1);
    // Every chunk is its own deliberate act: close, and count what is left.
    setConfirmOpen(false);
    refreshCount();
  }

  // What is left comes from the live count, so a failed address still counts as pending.
  const pendingNow   = count.status === "ready" ? count.data?.pending ?? null : null;
  const sendable     = pendingNow !== null && pendingNow > 0;
  const finished     = chunks > 0 && pendingNow === 0;
  const showContinue = chunks > 0 && sendable;
  const partialEnglish =
    kind === "english" && preview !== null && !preview.translation.fullyTranslated;
  const kindLabel    = KINDS.find((k) => k.value === kind)!.label;
  const courseTitle  = courses.find((c) => c.slug === courseSlug)?.title ?? courseSlug;

  return (
    <div className="adjust-form">
      <div className="adjust-form-head">
        <span className="material-symbols-outlined">campaign</span>
        <h3>Anuncio de curso</h3>
        <span className="adjust-form-hint">Envía correo real · no se puede deshacer</span>
      </div>

      {/* ── 1. What and about which course ───────────────────────────────── */}
      <div className="filter-tabs">
        <div className="filter-tabs-row">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              className={`filter-tab ${kind === k.value ? "is-active" : ""}`}
              onClick={() => edit(setKind)(k.value)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <p className="announce-hint">{KINDS.find((k) => k.value === kind)!.hint}</p>

      <div className="schedule-settings">
        <label className="schedule-setting">
          <span>Curso</span>
          <select value={courseSlug} onChange={(e) => edit(setCourseSlug)(e.target.value)}>
            {courses.length === 0 && <option value="">No hay cursos publicados</option>}
            {courses.map((c) => (
              <option key={c.slug} value={c.slug}>{c.title}</option>
            ))}
          </select>
        </label>
      </div>

      {/* ── 2. The update-only fields ─────────────────────────────────────── */}
      {kind === "update" && (
        <div className="announce-update-fields">
          <label className="schedule-setting">
            <span>Novedad — la única línea que escribes tú</span>
            <input
              type="text"
              maxLength={MAX_WHATS_NEW}
              placeholder="ej: He reescrito el bloque 4 con ejemplos nuevos de atención."
              value={whatsNew}
              onChange={(e) => edit(setWhatsNew)(e.target.value)}
            />
          </label>

          <label className="schedule-setting">
            <span>Clave del anuncio</span>
            <input
              type="text"
              className="mono"
              placeholder={defaultUpdateKey(courseSlug)}
              value={keyOverride}
              onChange={(e) => edit(setKeyOverride)(e.target.value)}
            />
          </label>

          <p className="announce-warn">
            <span className="material-symbols-outlined">warning</span>
            Cada actualización necesita una clave distinta. Si reutilizas la clave de un
            anuncio anterior, quien ya lo recibió será saltado y no volverá a recibir nada.
          </p>
          {resolvedKey && (
            <p className="announce-key">
              Se usará: <code>{resolvedKey}</code>
            </p>
          )}
        </div>
      )}

      {/* ── How many it reaches — live, before any preview ─────────────────── */}
      <RecipientCount count={count} onRetry={refreshCount} />

      {/* ── 3. Preview ────────────────────────────────────────────────────── */}
      <div className="adjust-form-row">
        <button className="btn-primary" onClick={runPreview} disabled={loading || !courseSlug}>
          {loading && !preview ? "Cargando…" : "Previsualizar"}
        </button>
        {preview && <span className="muted">Previsualización de {preview.announcementKey}</span>}
      </div>

      {error && <p className="adjust-form-error">{error}</p>}

      {preview && (
        <>
          {partialEnglish && (
            <p className="announce-warn">
              <span className="material-symbols-outlined">warning</span>
              Solo {preview.translation.translated} de {preview.translation.total} lecciones
              están traducidas al inglés. Este correo dice que la versión inglesa ya está
              disponible.
            </p>
          )}

          <AnnounceSamples samples={preview.samples} />

          {/* ── 4. Send ─────────────────────────────────────────────────── */}
          {pendingNow === null ? null : !sendable ? (
            chunks === 0 && (
              <p className="announce-empty">
                <strong>0 destinatarios.</strong>{" "}
                {count.data?.subscribers === 0
                  ? "Todavía no hay nadie suscrito a los cursos."
                  : `Los ${count.data?.subscribers} suscriptores ya recibieron el anuncio con la clave «${preview.announcementKey}».`}
              </p>
            )
          ) : (
            <div className="announce-send">
              <div className="adjust-form-row">
                <button className="btn-primary" onClick={openConfirm} disabled={loading}>
                  <span className="material-symbols-outlined" aria-hidden="true">send</span>
                  {showContinue ? `Continuar (quedan ${pendingNow})` : "Enviar…"}
                </button>
              </div>
              <p className="announce-hint">
                Se envía por tandas para no exceder el límite de la función. Cada tanda pide
                confirmación otra vez.
              </p>
            </div>
          )}

          {confirmOpen && (
            <ConfirmSendDialog
              count={count}
              subject={`${kindLabel} · ${courseTitle}`}
              sending={loading}
              onConfirm={runSend}
              onClose={() => setConfirmOpen(false)}
            />
          )}

          {(totals.sent > 0 || totals.failed > 0) && (
            <div className="announce-result">
              <p className={finished ? "success-text" : "muted"}>
                {finished ? "✓ Envío completado. " : ""}
                Enviados: <strong>{totals.sent}</strong> · Fallidos:{" "}
                <strong>{totals.failed}</strong>
                {pendingNow !== null && !finished ? ` · Quedan ${pendingNow}` : ""}
              </p>
              {totals.failedTo.length > 0 && (
                <p className="error-text mono">No se pudo enviar a: {totals.failedTo.join(", ")}</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
