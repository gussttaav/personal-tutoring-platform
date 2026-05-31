/**
 * REFACTOR-P4-02: Route-handler helper that seeds the request-scoped ALS store
 * from the `x-request-id` header forwarded by the middleware.
 *
 * Wrap route handlers that perform meaningful work (book, cancel, chat,
 * webhook, admin) so every log line within the request carries its requestId.
 */

import type { NextRequest } from "next/server";
import { withRequestContext } from "./request-context";

export function tracedRoute<Args extends unknown[], R>(
  handler: (req: NextRequest, ...args: Args) => Promise<R>,
) {
  return (req: NextRequest, ...args: Args): Promise<R> => {
    const requestId = req.headers.get("x-request-id") ?? "req_unknown";
    return withRequestContext({ requestId }, () => handler(req, ...args));
  };
}
