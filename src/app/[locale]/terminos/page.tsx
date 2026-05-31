// src/app/terminos/page.tsx
// Publicly accessible terms of service page.

import type { Metadata } from "next";
import PolicyPage from "@/components/policy/PolicyPage";
import { TerminosContent } from "@/components/policy/PolicyContent";

export const metadata: Metadata = {
  title: "Términos de servicio — Gustavo Torres",
  description:
    "Términos de servicio de gustavoai.dev. Condiciones de uso, pagos, cancelaciones y responsabilidad.",
  robots: { index: true, follow: true },
};

export default function TerminosPage() {
  return (
    <PolicyPage title="Términos de servicio" lastUpdated="Junio 2025">
      <TerminosContent />
    </PolicyPage>
  );
}
