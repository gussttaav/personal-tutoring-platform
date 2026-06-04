"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";

// Intermediate page loaded inside the popup window.
// Calling signIn() here lets NextAuth handle CSRF token acquisition and the
// OAuth redirect, which is required — a plain GET to /api/auth/signin/google
// does not initiate the OAuth flow.
function SignInPopupContent() {
  const t = useTranslations("auth.signin");
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  useEffect(() => {
    signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm">
      {t("redirecting")}
    </div>
  );
}

export default function SignInPopupPage() {
  const t = useTranslations("auth.signin");
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen text-sm">
          {t("redirecting")}
        </div>
      }
    >
      <SignInPopupContent />
    </Suspense>
  );
}
