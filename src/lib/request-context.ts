/**
 * REFACTOR-P4-02: Request-scoped context via AsyncLocalStorage.
 *
 * The middleware seeds the store with a request ID. Anything called downstream
 * (services, repositories, the logger) can read it without explicit threading.
 *
 * AsyncLocalStorage is stable in Node 18+ and supported on Vercel's serverless
 * runtime. NOT supported in Edge runtime — keep this strictly server-only.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  // Add other request-scoped fields here as needed (userId, traceparent, etc.)
}

const storage = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getRequestId(): string | null {
  return storage.getStore()?.requestId ?? null;
}
