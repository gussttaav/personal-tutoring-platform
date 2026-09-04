// Publicly accessible terms of service page.

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PolicyPage from "@/components/policy/PolicyPage";
import { TerminosContent } from "@/components/policy/PolicyContent";
import { localizedAlternates } from "@/lib/hreflang";
import { getPackValidityDays } from "@/lib/pricing-display";
import { getScheduleConfig } from "@/lib/schedule-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.terminos" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    alternates: localizedAlternates("/terminos", locale),
  };
}

export default async function TerminosPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tModal = await getTranslations({ locale, namespace: "footerModals" });
  const [packValidityDays, schedule] = await Promise.all([
    getPackValidityDays(),
    getScheduleConfig(),
  ]);
  return (
    <PolicyPage title={tModal("terms")} lastUpdated={locale === "en" ? "September 2026" : "Septiembre 2026"}>
      <TerminosContent
        locale={locale}
        packValidityDays={packValidityDays}
        cancelHours={schedule.cancelMinNoticeHours}
      />
    </PolicyPage>
  );
}
