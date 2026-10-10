/**
 * BLOG-15 — the rendered email of an announcement dry run, one sandboxed frame per language.
 * Extracted from CourseAnnounceForm (COURSE-P6-02b) so the blog announcement form shows its
 * samples the same way. Admin panel is Spanish.
 */
"use client";

export interface AnnounceSample {
  subject: string;
  html:    string;
}

/* The sample renders in its own document, so globals.css never reaches it and the frame falls
   back to the browser's chunky default bar. Same rule as the app's (globals.css "Emerald
   Nocturne"), with the custom properties resolved to literals because :root does not cross the
   frame boundary. Injected into <head> rather than added to the email template: this is preview
   chrome, and what ships has to stay exactly what the dry run returned. */
const PREVIEW_CHROME = `<style>
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #3c4a42; border-radius: 10px; }
  ::-webkit-scrollbar-thumb:hover { background: #4edea3; }
</style>`;

/** The email exactly as sent, plus the scrollbar rule above. A template without a </head>
 *  is returned untouched — it just keeps the default bar. */
function withPreviewChrome(html: string): string {
  return html.replace("</head>", `${PREVIEW_CHROME}</head>`);
}

const LOCALES = ["es", "en"] as const;
const LOCALE_LABEL: Record<(typeof LOCALES)[number], string> = { es: "Español", en: "Inglés" };

/** The email exactly as it will arrive, in both languages. Sandboxed with no permissions at
 *  all: the samples are inert, so the links in them do not open. */
export function AnnounceSamples({ samples }: { samples: Partial<Record<"es" | "en", AnnounceSample>> }) {
  return (
    <div className="announce-samples">
      {LOCALES.map((locale) => {
        const sample = samples[locale];
        if (!sample) return null;
        return (
          <div key={locale} className="announce-sample">
            <div className="announce-sample-head">
              <span className="type-pill">{LOCALE_LABEL[locale]}</span>
              <strong>{sample.subject}</strong>
            </div>
            <iframe
              className="announce-frame"
              sandbox=""
              title={`Vista previa (${LOCALE_LABEL[locale]})`}
              srcDoc={withPreviewChrome(sample.html)}
            />
          </div>
        );
      })}
    </div>
  );
}
