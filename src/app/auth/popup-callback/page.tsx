"use client";

import { useEffect } from "react";

export default function PopupCallbackPage() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: "AUTH_COMPLETE" }, window.location.origin);
      window.close();
    } else {
      // Direct navigation (not in a popup) — redirect to home
      window.location.replace("/");
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen text-sm">
      Autenticación completada. Cerrando…
    </div>
  );
}
