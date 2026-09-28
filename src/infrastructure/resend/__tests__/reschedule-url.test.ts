// REDESIGN-P0-02 — the confirmation email's «reprogramar» link now points at /mentoria.
//
// sendConfirmationEmail itself can't be rendered under Jest (getTranslations needs Next's
// config resolution — see announcement-namespaces.test.ts), so this pins the pure URL-building
// slice it delegates to.

import { rescheduleUrl } from "../email-functions";

const BASE = process.env.NEXT_PUBLIC_BASE_URL ?? "https://gustavoai.dev";

describe("rescheduleUrl", () => {
  it.each(["free15min", "session1h", "session2h", "pack"])(
    "points %s at /mentoria with the reschedule and token params",
    (sessionType) => {
      expect(rescheduleUrl(sessionType, "tok123")).toBe(
        `${BASE}/mentoria?reschedule=${sessionType}&token=tok123`,
      );
    },
  );
});
