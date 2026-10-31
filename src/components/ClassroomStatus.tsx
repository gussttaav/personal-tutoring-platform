"use client";

/**
 * ClassroomStatus — the two screens /sesion/[token] shows instead of the
 * classroom (SESSION-JOIN-01):
 *
 *   - ClassroomUnavailable: the link's booking is no longer confirmed (cancelled,
 *     rescheduled, finished) or never existed. Replaces a silent redirect to `/`,
 *     which for a signed-in visitor bounced on to /admin or /area-personal with no
 *     explanation.
 *   - ClassroomNotOpenYet: a student before the classroom opens
 *     (start − booking_settings.join_open_minutes_before). Counts down and
 *     refreshes the server page when it opens, which then renders PreJoinSetup.
 *
 * Times are formatted in the viewer's own timezone, after mount (the server
 * doesn't know it), the same way the personal area does.
 */

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { COLORS } from "@/constants";
import {
  FeedbackMain,
  IconHalo,
  Eyebrow,
  FbTitle,
  FbBody,
  HeaderBlock,
  FbButton,
  Helper,
} from "@/components/ui";

export function ClassroomUnavailable() {
  const t      = useTranslations("pages.sesion");
  const router = useRouter();

  return (
    <FeedbackMain>
      <IconHalo tone="neutral" glyph="event_busy" />
      <HeaderBlock>
        <Eyebrow tone="neutral">{t("unavailableEyebrow")}</Eyebrow>
        <FbTitle>{t("unavailableTitle")}</FbTitle>
        <FbBody>{t("unavailableBody")}</FbBody>
      </HeaderBlock>
      <FbButton variant="primary" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
        {t("goToPersonalArea")}
      </FbButton>
      <Helper>
        <a href="mailto:contacto@gustavoai.dev" style={{ color: COLORS.brand, textDecoration: "none" }}>
          {t("unavailableHelp")}
        </a>
      </Helper>
    </FeedbackMain>
  );
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const days  = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins  = Math.floor((totalSec % 3600) / 60);
  const secs  = totalSec % 60;
  if (days > 0)  return `${days} d ${hours} h`;
  if (hours > 0) return `${hours} h ${mins} min`;
  if (mins > 0)  return `${mins} min ${String(secs).padStart(2, "0")} s`;
  return `${secs} s`;
}

export function ClassroomNotOpenYet({
  startIso,
  opensAtIso,
  sessionLabel,
  openMinutesBefore,
}: {
  startIso:          string;
  opensAtIso:        string;
  sessionLabel:      string;
  openMinutesBefore: number;
}) {
  const t      = useTranslations("pages.sesion");
  const locale = useLocale();
  const router = useRouter();
  // null until mounted: the countdown and the viewer-timezone labels are client-only.
  const [now, setNow] = useState<number | null>(null);
  const opensAtMs = new Date(opensAtIso).getTime();

  useEffect(() => {
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (current >= opensAtMs) router.refresh();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [opensAtMs, router]);

  const intlLocale = locale === "en" ? "en-GB" : "es-ES";
  const time = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const date = new Intl.DateTimeFormat(intlLocale, { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(startIso));

  return (
    <FeedbackMain>
      <IconHalo tone="warning" glyph="schedule" />
      <HeaderBlock>
        <Eyebrow tone="warning">{t("notOpenEyebrow")}</Eyebrow>
        <FbTitle>{now === null ? " " : t("notOpenTitle", { time: time(opensAtIso) })}</FbTitle>
        {now !== null && (
          <FbBody>
            {t("notOpenBody", {
              session: sessionLabel.toLowerCase(),
              date,
              start:   time(startIso),
              minutes: openMinutesBefore,
            })}
          </FbBody>
        )}
      </HeaderBlock>
      {now !== null && (
        <p
          role="timer"
          aria-live="off"
          style={{ textAlign: "center", fontSize: 15, fontWeight: 600, color: COLORS.textPrimary, margin: 0 }}
        >
          {t("notOpenCountdown", { time: formatCountdown(opensAtMs - now) })}
        </p>
      )}
      <FbButton variant="ghost" onClick={() => router.push("/area-personal")} style={{ width: "100%" }}>
        {t("goToPersonalArea")}
      </FbButton>
    </FeedbackMain>
  );
}
