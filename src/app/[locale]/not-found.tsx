import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("pages.notFound");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="font-headline text-4xl font-bold">{t("title")}</h1>
      <p className="text-base opacity-80">{t("body")}</p>
      <Link href="/" className="underline">
        {t("backHome")}
      </Link>
    </main>
  );
}
