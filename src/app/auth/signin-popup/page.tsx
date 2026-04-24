"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

// Intermediate page loaded inside the popup window.
// Calling signIn() here lets NextAuth handle CSRF token acquisition and the
// OAuth redirect, which is required — a plain GET to /api/auth/signin/google
// does not initiate the OAuth flow.
export default function SignInPopupPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  useEffect(() => {
    signIn("google", { callbackUrl });
  }, [callbackUrl]);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm">
      Redirigiendo a Google…
    </div>
  );
}
