// ACCOUNT-DELETE-WEB-01: publicly accessible (no login) account-deletion page.
// Referenced by the Google Play Data Deletion declaration for the mobile app —
// must load without auth, name the app/developer, and feature the deletion
// pathway prominently. See EliminarCuentaContent for the actual copy.

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import PolicyPage from "@/components/policy/PolicyPage";
import { EliminarCuentaContent } from "@/components/policy/PolicyContent";
import { localizedAlternates } from "@/lib/hreflang";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta.eliminarCuenta" });
  return {
    title: t("title"),
    description: t("description"),
    robots: { index: true, follow: true },
    alternates: localizedAlternates("/eliminar-cuenta", locale),
  };
}

export default async function EliminarCuentaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "meta.eliminarCuenta" });
  return (
    <PolicyPage title={t("heading")} lastUpdated={locale === "en" ? "September 2026" : "Septiembre 2026"}>
      <EliminarCuentaContent locale={locale} />
    </PolicyPage>
  );
}
