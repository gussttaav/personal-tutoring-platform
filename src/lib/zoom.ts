/**
 * lib/zoom.ts — Zoom Video SDK utilities
 *
 * Provides three exports:
 *   - createZoomSession: creates a per-booking Zoom Video SDK session via REST API
 *   - generateZoomJWT:   signs a short-lived JWT so a browser client can join
 *   - getSessionDurationWithGrace: returns session length + grace buffer in minutes
 *
 * Applied fixes:
 *   SEC-03: added studentEmail to ZoomSessionRecord for session-membership enforcement
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";

const ZOOM_KEY    = process.env.ZOOM_VIDEO_SDK_KEY!;
const ZOOM_SECRET = process.env.ZOOM_VIDEO_SDK_SECRET!;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ZoomSessionRecord {
  sessionId:       string;
  sessionName:     string;
  sessionPasscode: string;
  startIso:        string;
  durationMinutes: number;
  sessionType:     string;
  studentEmail:    string;  // SEC-03
}

// ─── generateZoomSessionCredentials ──────────────────────────────────────────

/**
 * Generates a unique session name and passcode for a Zoom Video SDK session.
 *
 * NOTE: The Zoom Video SDK does NOT require pre-registering a session via REST
 * API. Sessions are created implicitly when the first participant joins using a
 * valid signed JWT. The SDK Key/Secret are only for JWT signing — they cannot
 * be used for REST API auth (which requires Server-to-Server OAuth).
 *
 * The returned sessionId is a local identifier equal to the sessionName; it is
 * stored in Redis so /api/zoom/end can look it up.
 */
export function generateZoomSessionCredentials(params: {
  sessionName: string;
}): { sessionId: string; sessionName: string; sessionPasscode: string } {
  const sessionPasscode = crypto.randomBytes(5).toString("hex"); // 10-char hex (Zoom max is 10)
  return {
    sessionId:       params.sessionName, // used as the local lookup key
    sessionName:     params.sessionName,
    sessionPasscode,
  };
}

// ─── generateZoomJWT ──────────────────────────────────────────────────────────

/**
 * Signs a short-lived JWT (1 hour) that the browser client passes to
 * ZoomVideo client.join(). Role 1 = host, 0 = participant.
 */
export function generateZoomJWT(params: {
  sessionName:     string;
  role:            0 | 1;
  userName:        string;
  sessionPasscode: string;
}): string {
  const iat = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      app_key:       ZOOM_KEY,
      version:       1,          // required by Video SDK v2+
      tpc:           params.sessionName,
      role_type:     params.role,
      user_identity: params.userName,
      session_key:   params.sessionPasscode,
      iat,
      exp:           iat + 3600,
    },
    ZOOM_SECRET,
    { algorithm: "HS256" }
  );
}

// ─── getSessionDurationWithGrace ──────────────────────────────────────────────

/**
 * Returns the total allowed session length in minutes, including a grace period
 * that keeps the Zoom room open a bit after the nominal end time.
 */
export function getSessionDurationWithGrace(sessionType: string): number {
  switch (sessionType) {
    case "free15min": return 20;   // 15 + 5
    case "session1h": return 70;   // 60 + 10
    case "session2h": return 130;  // 120 + 10
    case "pack":      return 70;   // treat as 1h
    default:          return 70;
  }
}
