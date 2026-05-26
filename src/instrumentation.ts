import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
    // REFACTOR-P2-02: Promote ADMIN_EMAILS addresses to 'admin' in the DB once
    // at startup. After this runs, ADMIN_EMAILS is never consulted again in the
    // request path — the DB role is the sole source of truth.
    const { userService } = await import("@/services");
    await userService.bootstrapAdminsFromEnv();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
