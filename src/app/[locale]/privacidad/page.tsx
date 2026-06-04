// Publicly accessible privacy policy page.
// Referenced by Google OAuth consent screen and external links.

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PolicyPage from "@/components/policy/PolicyPage";
import { PrivacidadContent } from "@/components/policy/PolicyContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.privacidad" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
  };
}

export default async function PrivacidadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tModal = await getTranslations({ locale, namespace: "footerModals" });
  return (
    <PolicyPage title={tModal("privacy")} lastUpdated="Junio 2025">
      <PrivacidadContent locale={locale} />
    </PolicyPage>
  );
}
