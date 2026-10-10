/**
 * BLOG-15 — the send screen for blog post announcements. Admin panel is Spanish.
 *
 * The course announcement's flow (CourseAnnounceForm), for a new article:
 *
 *   1. pick the article                →  the live count appears: who it would reach
 *   2. Previsualizar (dry run)         →  the real rendered email, in both languages
 *   3. Enviar → dialog with the total  →  type ENVIAR; again for every chunk after the first
 *
 * Who it reaches is the subscribers whose areas match the post's (or every subscriber, for a
 * post with no area), minus whoever already has it: a post is announced once, under
 * `post:<slug>`. As in the course form, `confirm: true` is only sent after a preview of the
 * same article, and the server refuses to send without it anyway.
 */
"use client";

import { useState } from "react";
import type { BlogArea } from "@/domain/types";
import { AnnounceSamples, type AnnounceSample } from "./AnnounceSamples";
import { ConfirmSendDialog } from "./ConfirmSendDialog";
import { RecipientCount } from "./RecipientCount";
import { useRecipientCount } from "./useRecipientCount";

export interface PostOption {
  slug:  string;
  title: string;
  date:  string;
  areas: BlogArea[];
  /** Locales the post is published in. */
  locales: ("es" | "en")[];
}

interface DryRun {
  dryRun:          true;
  announcementKey: string;
  post:            { slug: string; title: string; areas: BlogArea[]; locales: ("es" | "en")[] };
  subscribers:     number;
  matching:        number;
  alreadyNotified: number;
  pending:         number;
  wouldSendNow:    number;
  byLocale:        { es: number; en: number };
  samples:         Partial<Record<"es" | "en", AnnounceSample>>;
}

interface SendResult {
  dryRun:   false;
  sent:     number;
  failed:   number;
  failedTo: string[];
}

const ENDPOINT = "/api/admin/blog-announce";

/** Admin-facing area names. The panel is Spanish and outside next-intl. */
const AREA_LABEL: Record<BlogArea, string> = {
  "ia":             "Inteligencia artificial",
  "bases-de-datos": "Bases de datos",
  "matematicas":    "Matemáticas",
  "programacion":   "Programación",
};

const areaList = (areas: BlogArea[]) =>
  areas.length > 0 ? areas.map((a) => AREA_LABEL[a]).join(" · ") : "Sin área (llega a todos)";

export function BlogAnnounceForm({ posts }: { posts: PostOption[] }) {
  const [slug, setSlug] = useState(posts[0]?.slug ?? "");

  const [preview, setPreview]         = useState<DryRun | null>(null);
  const [totals, setTotals]           = useState({ sent: 0, failed: 0, failedTo: [] as string[] });
  const [chunks, setChunks]           = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const { count, refresh: refreshCount } = useRecipientCount(ENDPOINT, slug ? { slug } : null);

  const post = posts.find((p) => p.slug === slug) ?? null;

  /** Picking another article throws away everything about the previous one. */
  function pick(next: string) {
    setSlug(next);
    setPreview(null);
    setTotals({ sent: 0, failed: 0, failedTo: [] });
    setChunks(0);
    setConfirmOpen(false);
    setError(null);
  }

  async function request(body: Record<string, unknown>): Promise<unknown | null> {
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
    if (!slug) { setError("Elige un artículo."); return; }
    setPreview(null);
    const data = await request({ slug });
    if (data) setPreview(data as DryRun);
  }

  function openConfirm() {
    // Read the total again as the dialog opens: it is the number the operator confirms.
    refreshCount();
    setConfirmOpen(true);
  }

  async function runSend() {
    if (!preview) return;
    // `offset: 0`, never the previous chunk's end: the chunk just sent removed itself from the
    // list of people still to notify (see the course form and route for the long version).
    const data = await request({ slug: preview.post.slug, confirm: true, offset: 0 });
    if (!data) return;

    const result = data as SendResult;
    setTotals((t) => ({
      sent:     t.sent + result.sent,
      failed:   t.failed + result.failed,
      failedTo: [...t.failedTo, ...result.failedTo],
    }));
    setChunks((n) => n + 1);
    setConfirmOpen(false);
    refreshCount();
  }

  const pendingNow   = count.status === "ready" ? count.data?.pending ?? null : null;
  const sendable     = pendingNow !== null && pendingNow > 0;
  const finished     = chunks > 0 && pendingNow === 0;
  const showContinue = chunks > 0 && sendable;
  const spanishOnly  = preview !== null && !preview.post.locales.includes("en");

  /** Why nobody would get it — the three different reasons read very differently. */
  function emptyReason(): string {
    const data = count.data;
    if (!data || data.subscribers === 0) return "Todavía no hay nadie suscrito al blog.";
    if (data.matching === 0) return "Ninguno de los suscriptores sigue las áreas de este artículo.";
    return `Las ${data.matching} personas que siguen estas áreas ya recibieron este artículo.`;
  }

  return (
    <div className="adjust-form">
      <div className="adjust-form-head">
        <span className="material-symbols-outlined">notifications_active</span>
        <h3>Aviso de artículo nuevo</h3>
        <span className="adjust-form-hint">Envía correo real · no se puede deshacer</span>
      </div>

      {/* ── 1. Which article ──────────────────────────────────────────────── */}
      <div className="schedule-settings">
        <label className="schedule-setting">
          <span>Artículo</span>
          <select value={slug} onChange={(e) => pick(e.target.value)}>
            {posts.length === 0 && <option value="">No hay artículos publicados</option>}
            {posts.map((p) => (
              <option key={p.slug} value={p.slug}>{p.date} · {p.title}</option>
            ))}
          </select>
        </label>
      </div>
      {post && (
        <p className="announce-hint">
          Áreas: {areaList(post.areas)}
          {!post.locales.includes("en") && " · solo en español"}
        </p>
      )}

      {/* ── How many it reaches — live, before any preview ─────────────────── */}
      <RecipientCount count={count} onRetry={refreshCount} />

      {/* ── 2. Preview ────────────────────────────────────────────────────── */}
      <div className="adjust-form-row">
        <button className="btn-primary" onClick={runPreview} disabled={loading || !slug}>
          {loading && !preview ? "Cargando…" : "Previsualizar"}
        </button>
        {preview && <span className="muted">Previsualización de {preview.announcementKey}</span>}
      </div>

      {error && <p className="adjust-form-error">{error}</p>}

      {preview && (
        <>
          {spanishOnly && (
            <p className="announce-warn">
              <span className="material-symbols-outlined">warning</span>
              Este artículo aún no está en inglés. Quien lea en inglés recibirá el aviso en inglés
              con un enlace a la versión en español, y el correo lo explica.
            </p>
          )}

          <AnnounceSamples samples={preview.samples} />

          {/* ── 3. Send ─────────────────────────────────────────────────── */}
          {pendingNow === null ? null : !sendable ? (
            chunks === 0 && (
              <p className="announce-empty">
                <strong>0 destinatarios.</strong> {emptyReason()}
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
              subject={`Artículo · ${preview.post.title}`}
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
