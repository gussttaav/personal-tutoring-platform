const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 600;
const POPUP_TIMEOUT_MS = 5 * 60 * 1000;

export type PopupResult =
  | { success: true; blocked: false }
  | { success: false; blocked: true } // popup blocked → caller should fall back to redirect
  | { success: false; blocked: false }; // user closed popup without completing auth

function openCenteredPopup(url: string): Window | null {
  const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
  return window.open(
    url,
    "google-sign-in",
    `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},` +
      `toolbar=no,menubar=no,scrollbars=no,resizable=no`,
  );
}

export function signInWithPopup(callbackUrl = "/"): Promise<PopupResult> {
  const popupCallbackUrl = `/auth/popup-callback?next=${encodeURIComponent(callbackUrl)}`;
  // Open an intermediate Next.js page that calls signIn() on mount.
  // A bare GET to /api/auth/signin/google doesn't initiate OAuth in NextAuth v5
  // because it requires a CSRF-protected POST — signIn() from next-auth/react handles that.
  const signInUrl = `/auth/signin-popup?callbackUrl=${encodeURIComponent(popupCallbackUrl)}`;

  const popup = openCenteredPopup(signInUrl);

  if (!popup) {
    return Promise.resolve({ success: false, blocked: true });
  }

  return new Promise<PopupResult>((resolve) => {
    let settled = false;

    const settle = (result: PopupResult) => {
      if (settled) return;
      settled = true;
      clearInterval(closedPoll);
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      resolve(result);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "AUTH_COMPLETE") {
        popup.close();
        settle({ success: true, blocked: false });
      }
    };

    const closedPoll = setInterval(() => {
      if (popup.closed) settle({ success: false, blocked: false });
    }, 500);

    const timeout = setTimeout(
      () => settle({ success: false, blocked: false }),
      POPUP_TIMEOUT_MS,
    );

    window.addEventListener("message", onMessage);
  });
}
