import Link from "next/link";

// Render boundary for notFound() (e.g. unknown locale) and unmatched routes
// within the [locale] segment. Spanish only in Phase 1 — translated in a later phase.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-headline text-4xl font-bold">Página no encontrada</h1>
      <p className="text-base opacity-80">
        Lo sentimos, la página que buscas no existe.
      </p>
      <Link href="/" className="underline">
        Volver al inicio
      </Link>
    </main>
  );
}
