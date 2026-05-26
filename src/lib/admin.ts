/**
 * lib/admin.ts
 *
 * REFACTOR-P2-02: Admin status comes from session.user.isAdmin, which is
 * computed in the NextAuth JWT callback from the users.role column.
 * See src/auth.ts and src/services/UserService.ts.
 */

import type { Session } from "next-auth";

export function isAdmin(session: Session | null): boolean {
  return session?.user?.isAdmin === true;
}
