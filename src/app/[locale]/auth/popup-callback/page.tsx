"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function PopupCallbackPage() {
  const t = useTranslations("auth.callback");

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: "AUTH_COMPLETE" }, window.location.origin);
      window.close();
    } else {
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm">
      {t("closing")}
    </div>
  );
}
