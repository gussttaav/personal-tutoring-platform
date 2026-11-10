// CHAT-AGENT-P3-02: «Comparar con mi calendario», the browser half. A one-hour access token
// for `calendar.freebusy` from Google Identity Services' token client (a Google popup, asked
// at the moment of use, never at sign-in), then Google's freeBusy endpoint called from the
// browser. Neither the token nor the busy intervals reach our server or Claude.
//
// The grant is kept (Q4): there is no `google.accounts.oauth2.revoke` here, so a later
// comparison asks for a new token with `prompt: ""` and Google answers without a consent
// screen. The visitor revokes it at myaccount.google.com/permissions (privacy policy, P3-01).
//
// The popup flow needs no third-party cookies; don't switch to the implicit iframe flow.

import type { TimeInterval } from "./slot-overlap";

const GIS_SRC         = "https://accounts.google.com/gsi/client";
const FREEBUSY_SCOPE  = "https://www.googleapis.com/auth/calendar.freebusy";
const FREEBUSY_URL    = "https://www.googleapis.com/calendar/v3/freeBusy";
const EXPIRY_MARGIN_MS = 60_000; // a token this close to expiring is asked for again

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export interface FreeBusyToken {
  accessToken: string;
  /** Epoch ms after which the token is not reused. */
  expiresAt:   number;
}

/**
 * Why a comparison didn't happen. `dismissed`: the visitor closed the popup or declined (the
 * chips stay as they were, no message). `blocked`: their Workspace admin doesn't allow the
 * app. `failed`: anything else (script, popup, Google API).
 */
export type FreeBusyErrorKind = "dismissed" | "blocked" | "failed";

export class FreeBusyError extends Error {
  constructor(readonly kind: FreeBusyErrorKind, message: string) {
    super(message);
    this.name = "FreeBusyError";
  }
}

// ─── Minimal GIS types (the part of google.accounts.oauth2 used here) ─────────

interface TokenResponse {
  access_token?: string;
  expires_in?:   number | string;
  error?:        string;
}

interface TokenClient {
  requestAccessToken(): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id:      string;
    scope:          string;
    login_hint?:    string;
    prompt?:        string;
    callback:       (response: TokenResponse) => void;
    error_callback: (error: { type?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, scope: string): boolean;
}

function gisOAuth2(): GoogleOAuth2 | undefined {
  return (window as unknown as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } })
    .google?.accounts?.oauth2;
}

// ─── Script loading ───────────────────────────────────────────────────────────

let gisPromise: Promise<GoogleOAuth2> | null = null;

/**
 * Loads the GIS script once. Called when the visitor points at or focuses the button, so the
 * script is usually there by the click and the popup opens inside the click's gesture.
 */
export function loadGis(): Promise<GoogleOAuth2> {
  const ready = gisOAuth2();
  if (ready) return Promise.resolve(ready);
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement("script");
    script.src   = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const oauth2 = gisOAuth2();
      if (oauth2) resolve(oauth2);
      else reject(new FreeBusyError("failed", "GIS loaded without google.accounts.oauth2"));
    };
    script.onerror = () => reject(new FreeBusyError("failed", "GIS script failed to load"));
    document.head.appendChild(script);
  }).catch((err: unknown) => {
    gisPromise = null; // a later click retries
    throw err;
  });
  return gisPromise;
}

// ─── Token ────────────────────────────────────────────────────────────────────

export function isTokenFresh(token: FreeBusyToken | null, nowMs = Date.now()): token is FreeBusyToken {
  return token !== null && token.expiresAt - EXPIRY_MARGIN_MS > nowMs;
}

function requestWith(oauth2: GoogleOAuth2, loginHint: string | undefined): Promise<FreeBusyToken> {
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id:  GOOGLE_CLIENT_ID,
      scope:      FREEBUSY_SCOPE,
      login_hint: loginHint,
      prompt:     "",
      callback: (response) => {
        if (response.error) {
          // `access_denied` is also what a plain «Cancelar» on the consent screen returns, so
          // only the Workspace-policy codes read as «your organisation doesn't allow this».
          const blocked = response.error === "admin_policy_enforced" || response.error === "org_internal";
          reject(new FreeBusyError(
            blocked ? "blocked" : response.error === "access_denied" ? "dismissed" : "failed",
            response.error,
          ));
          return;
        }
        if (!response.access_token || !oauth2.hasGrantedAllScopes(response, FREEBUSY_SCOPE)) {
          reject(new FreeBusyError("dismissed", "scope not granted"));
          return;
        }
        const seconds = Number(response.expires_in) || 3600;
        resolve({ accessToken: response.access_token, expiresAt: Date.now() + seconds * 1000 });
      },
      error_callback: (error) => {
        reject(new FreeBusyError(error.type === "popup_closed" ? "dismissed" : "failed", error.type ?? "unknown"));
      },
    });
    client.requestAccessToken();
  });
}

/**
 * Opens Google's popup and resolves with a free/busy token. Call it from the click handler:
 * when the script is already loaded, the popup opens synchronously inside the gesture.
 */
export function requestFreeBusyToken(loginHint?: string): Promise<FreeBusyToken> {
  if (!GOOGLE_CLIENT_ID) return Promise.reject(new FreeBusyError("failed", "no client id"));
  const ready = gisOAuth2();
  if (ready) return requestWith(ready, loginHint);
  return loadGis().then((oauth2) => requestWith(oauth2, loginHint));
}

// ─── freeBusy ─────────────────────────────────────────────────────────────────

/** Busy intervals of the visitor's primary calendar between `timeMin` and `timeMax`. */
export async function fetchBusy(token: string, timeMin: string, timeMax: string): Promise<TimeInterval[]> {
  let res: Response;
  try {
    res = await fetch(FREEBUSY_URL, {
      method:  "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ timeMin, timeMax, items: [{ id: "primary" }] }),
    });
  } catch {
    throw new FreeBusyError("failed", "freeBusy network error");
  }
  if (!res.ok) throw new FreeBusyError("failed", `freeBusy ${res.status}`);

  const data = (await res.json().catch(() => null)) as
    | { calendars?: { primary?: { busy?: TimeInterval[]; errors?: unknown[] } } }
    | null;
  const primary = data?.calendars?.primary;
  if (!primary || (Array.isArray(primary.errors) && primary.errors.length > 0)) {
    throw new FreeBusyError("failed", "freeBusy calendar error");
  }
  return Array.isArray(primary.busy) ? primary.busy : [];
}
