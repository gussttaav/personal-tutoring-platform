// Publicly accessible privacy policy page.
// Referenced by Google OAuth consent screen and external links.

import type { Metadata } from "next";
import PolicyPage from "@/components/policy/PolicyPage";
import { PrivacidadContent } from "@/components/policy/PolicyContent";

export const metadata: Metadata = {
  title: "Política de privacidad — Gustavo Torres",
  description:
    "Política de privacidad de gustavoai.dev. Información sobre qué datos se recogen, cómo se usan y tus derechos.",
  robots: { index: true, follow: true },
};

export default function PrivacidadPage() {
  return (
    <PolicyPage title="Política de privacidad" lastUpdated="Junio 2025">
      <PrivacidadContent />
    </PolicyPage>
  );
}
