// Publicly accessible terms of service page.

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PolicyPage from "@/components/policy/PolicyPage";
import { TerminosContent } from "@/components/policy/PolicyContent";

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
  return (
    <PolicyPage title={tModal("terms")} lastUpdated="Junio 2025">
      <TerminosContent locale={locale} />
    </PolicyPage>
  );
}
