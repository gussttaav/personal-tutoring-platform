/**
 * CONTENT-FEEDBACK-01: reader feedback on lessons and posts.
 *
 * Two lists from `contentFeedbackService.getAdminOverview()`:
 *   1. votes per content (most 👎 first) with that content's 👎 comments behind a
 *      native <details> — zero JS, the reading-block idiom;
 *   2. error reports, newest first, with an open/resolved toggle.
 *
 * Admin panel stays Spanish (CLAUDE.md).
 *
 * The page gates ITSELF before fetching, on top of the layout's gate. Next renders
 * a layout and its page segment in parallel, so the layout's `redirect()` does not
 * stop this page from rendering — and the rendered RSC payload (data included) is
 * embedded in the 307 document an unauthenticated `curl` receives. Checking here,
 * before `getAdminOverview()`, means a non-admin request never reaches the data.
 * (Verified against `pnpm start`; the other admin pages share the layout-only gate.)
 *
 * ADMIN-02: cells are marked for the phone layout (one card per row); the long ones
 * (comments, the report message) stack their label above the content.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/admin";
import { contentFeedbackService } from "@/services";
import { ReportStatusButton } from "@/components/admin/ReportStatusButton";
import { PageHeader, Card, Empty, StatusBadge } from "@/components/admin/ui";
import { fmtDateTime, relativeTime } from "@/components/admin/format";
import type { ContentType, ContentVoteComment } from "@/domain/types";

const KIND: Record<ContentType, string> = { lesson: "Lección", post: "Artículo" };

const ratio = (up: number, down: number): string =>
  up + down === 0 ? "—" : `${Math.round((up / (up + down)) * 100)}%`;

export default async function FeedbackPage() {
  if (!isAdmin(await auth())) redirect("/");

  const { aggregates, comments, reports } = await contentFeedbackService.getAdminOverview();

  const commentsByContent = new Map<string, ContentVoteComment[]>();
  for (const c of comments) {
    const key = `${c.contentType}|${c.contentKey}`;
    commentsByContent.set(key, [...(commentsByContent.get(key) ?? []), c]);
  }

  const openReports = reports.filter((r) => r.status === "open").length;

  return (
    <div className="page-stack">
      <PageHeader
        overline="Contenido"
        title="Feedback de lecciones y artículos"
        subtitle={`${aggregates.length} páginas con votos · ${openReports} reporte${openReports === 1 ? "" : "s"} abierto${openReports === 1 ? "" : "s"}`}
      />

      <Card title="Votos por contenido" padding={false}>
        {aggregates.length === 0 ? (
          <div className="card-body">
            <Empty icon="thumb_up" label="Todavía no hay votos." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contenido</th>
                <th>👍</th>
                <th>👎</th>
                <th>Ratio</th>
                <th>Último voto</th>
                <th>Comentarios</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a) => {
                const list = commentsByContent.get(`${a.contentType}|${a.contentKey}`) ?? [];
                return (
                  <tr key={`${a.contentType}|${a.contentKey}`}>
                    <td className="c-main">
                      <div className="cell-stack">
                        {a.pageUrl ? (
                          <a href={a.pageUrl} target="_blank" rel="noopener noreferrer">
                            {a.title ?? a.contentKey}
                          </a>
                        ) : (
                          <span className="muted">{a.title ?? a.contentKey}</span>
                        )}
                        <span className="cell-meta">
                          {KIND[a.contentType]} · <span className="mono">{a.contentKey}</span>
                          {!a.pageUrl && " · ya no publicado"}
                        </span>
                      </div>
                    </td>
                    <td className="success-text" data-label="👍">{a.up}</td>
                    <td className={a.down > 0 ? "error-text" : "muted"} data-label="👎">{a.down}</td>
                    <td className="muted" data-label="Ratio">{ratio(a.up, a.down)}</td>
                    <td data-label="Último voto">
                      <div className="cell-stack">
                        <span>{fmtDateTime(a.lastVoteAt)}</span>
                        <span className="cell-meta">{relativeTime(a.lastVoteAt)}</span>
                      </div>
                    </td>
                    <td className={list.length === 0 ? undefined : "c-block"} data-label="Comentarios">
                      {list.length === 0 ? (
                        <span className="muted">{a.comments === 0 ? "—" : a.comments}</span>
                      ) : (
                        <details>
                          <summary style={{ cursor: "pointer" }}>
                            {list.length} comentario{list.length === 1 ? "" : "s"}
                          </summary>
                          <div className="cell-stack" style={{ gap: 10, marginTop: 8, maxWidth: 420 }}>
                            {list.map((c) => (
                              <div key={c.id} className="cell-stack">
                                <span style={{ whiteSpace: "pre-wrap" }}>{c.comment}</span>
                                <span className="cell-meta">
                                  {c.locale} · {fmtDateTime(c.updatedAt)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Reportes de error" padding={false}>
        {reports.length === 0 ? (
          <div className="card-body">
            <Empty icon="check_circle" tone="good" label="Sin reportes de error." />
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Contenido</th>
                <th>Mensaje</th>
                <th>Reportado por</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <td data-label="Fecha">
                    <div className="cell-stack">
                      <span>{fmtDateTime(r.createdAt)}</span>
                      <span className="cell-meta">{relativeTime(r.createdAt)}</span>
                    </div>
                  </td>
                  <td className="c-main">
                    <div className="cell-stack">
                      <a href={r.pageUrl} target="_blank" rel="noopener noreferrer">
                        {r.contentKey}
                      </a>
                      <span className="cell-meta">
                        {KIND[r.contentType]} · {r.locale}
                      </span>
                    </div>
                  </td>
                  <td className="c-block" data-label="Mensaje" style={{ maxWidth: 420 }}>
                    {r.message.length > 120 ? (
                      <details>
                        <summary style={{ cursor: "pointer" }}>{r.message.slice(0, 120)}…</summary>
                        <div style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{r.message}</div>
                      </details>
                    ) : (
                      <span style={{ whiteSpace: "pre-wrap" }}>{r.message}</span>
                    )}
                  </td>
                  <td className={r.reporterEmail ? "" : "muted"} data-label="Reportado por">{r.reporterEmail ?? "anónimo"}</td>
                  <td className="c-side">
                    <div className="cell-stack">
                      <StatusBadge status={r.status} kind="report" />
                      {r.resolvedAt && <span className="cell-meta">{relativeTime(r.resolvedAt)}</span>}
                    </div>
                  </td>
                  <td className="cell-right c-act">
                    <ReportStatusButton id={r.id} status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
