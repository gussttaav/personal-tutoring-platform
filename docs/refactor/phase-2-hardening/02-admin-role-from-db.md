# Task P2-02 — Move admin check to `users.role` column

**Severity:** 🟡 Medium
**Effort:** 3–4 hours
**Owner:** _tbd_
**Status:** ⬜ Not started

## TL;DR

`isAdmin()` reads `ADMIN_EMAILS` from env on every request. The `users.role` column already exists in the schema with a CHECK constraint of `('student', 'teacher', 'admin')`. Switch to a DB lookup so admin status survives the env, can be changed without a deploy, and is auditable in the DB.

## Context

### The current code

```typescript
// src/lib/admin.ts
export function isAdmin(session: Session | null): boolean {
  if (!session?.user?.email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(session.user.email.toLowerCase());
}
```

```typescript
// src/auth.ts (session callback)
session.user.isAdmin = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(e => e.trim().toLowerCase())
  .includes((token.email as string ?? "").toLowerCase());
```

### Issues with env-based admin

1. **Two sources of truth:** the schema defines a `role` column with a CHECK constraint, but no code uses it. The env is the de facto source.
2. **Deploy required for change:** to add/remove an admin, edit Vercel env vars and trigger a redeploy.
3. **Not auditable:** there's no history of who was admin when. The DB column could carry a `role_changed_at` and an `audit_log` entry.
4. **Same string in two places:** `lib/admin.ts:isAdmin` and `auth.ts:session callback` both parse the env. Drift risk.

### The new approach

- Look up `users.role` in the JWT callback at sign-in and periodically thereafter (every hour) so role changes propagate without forcing re-login.
- Cache the result in the JWT, surface as `session.user.isAdmin`.
- `isAdmin()` becomes `session?.user?.isAdmin === true`.
- `ADMIN_EMAILS` env stays for the **bootstrap** case (no users exist yet) — first time a user with an email in `ADMIN_EMAILS` signs in, their `role` is set to `'admin'` and that env is never consulted again for them.

## Files affected

| File | Change |
|------|--------|
| `src/auth.ts` | JWT callback fetches role from DB, caches |
| `src/lib/admin.ts` | Simplify to read `session.user.isAdmin` |
| `src/domain/repositories/IUserRepository.ts` | Add `getRole`, `setRole` |
| `src/infrastructure/supabase/SupabaseUserRepository.ts` | Implement both |
| `src/services/UserService.ts` | Add `getRoleAndBootstrap(email)` — handles the bootstrap case |
| `src/__tests__/fixtures/InMemoryUserRepository.ts` | Implement both |
| `src/lib/__tests__/admin.test.ts` | Update tests to match new shape |

## The change

### 1. `src/domain/repositories/IUserRepository.ts`

```typescript
export interface IUserRepository {
  // ... existing methods ...

  /** Returns the user's role, or null if user doesn't exist. */
  getRole(email: string): Promise<"student" | "teacher" | "admin" | null>;

  /** Updates a user's role. Throws if user doesn't exist. */
  setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void>;
}
```

### 2. `src/infrastructure/supabase/SupabaseUserRepository.ts`

```typescript
async getRole(email: string): Promise<"student" | "teacher" | "admin" | null> {
  const { data, error } = await supabase
    .from("users")
    .select("role")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data.role as "student" | "teacher" | "admin";
}

async setRole(email: string, role: "student" | "teacher" | "admin"): Promise<void> {
  const { error, count } = await supabase
    .from("users")
    .update({ role })
    .eq("email", email.toLowerCase().trim());
  if (error) throw error;
  if (count === 0) throw new Error(`User not found: ${email}`);
}
```

### 3. `src/services/UserService.ts`

```typescript
// REFACTOR-P2-02: Resolves a user's role with bootstrap support. If the user's
// role is 'student' but their email is in ADMIN_EMAILS, promote them to admin
// once and persist. After bootstrap, ADMIN_EMAILS is never consulted again for
// that user — the DB is the source of truth.
async getRoleAndBootstrap(email: string): Promise<"student" | "teacher" | "admin"> {
  const normalized = email.toLowerCase().trim();
  let role = await this.users.getRole(normalized);

  if (role === null) {
    // User doesn't exist yet — ensureUser will create as 'student', then bootstrap
    await this.ensureUser(normalized);
    role = "student";
  }

  if (role === "student") {
    const bootstrapAdmins = (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    if (bootstrapAdmins.includes(normalized)) {
      await this.users.setRole(normalized, "admin");
      role = "admin";
      log("info", "Bootstrapped admin role from ADMIN_EMAILS", {
        service: "UserService",
        email: normalized,
      });
    }
  }

  return role;
}
```

### 4. `src/auth.ts`

Update the JWT callback to fetch role at sign-in and every hour:

```typescript
import { userService } from "@/services";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // ... existing providers, session strategy, callbacks.signIn ...

  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        await userService.ensureUser(
          user.email,
          user.name  ?? undefined,
          user.image ?? undefined,
        );
      }
      return true;
    },

    async jwt({ token, profile, trigger }) {
      if (profile) {
        token.email   = profile.email   ?? token.email;
        token.name    = profile.name    ?? token.name;
        token.picture = profile.picture ?? token.picture;
      }

      // REFACTOR-P2-02: Refresh role from DB at sign-in and once per hour.
      // Changes to a user's role in DB propagate within an hour without
      // forcing re-login.
      const ONE_HOUR_MS = 3_600_000;
      const stale = !token.roleFetchedAt
        || Date.now() - (token.roleFetchedAt as number) > ONE_HOUR_MS;

      if (token.email && (trigger === "signIn" || stale)) {
        try {
          token.role = await userService.getRoleAndBootstrap(token.email as string);
          token.roleFetchedAt = Date.now();
        } catch (err) {
          // Don't fail auth if DB is down — fall back to existing role on the token
          // or 'student' on first run
          console.error("Failed to fetch role:", err);
          token.role = token.role ?? "student";
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.email = token.email as string;
      session.user.name  = token.name as string;
      session.user.image = (token.picture as string | undefined) ?? null;
      // REFACTOR-P2-02: isAdmin computed from DB-backed role on the token
      session.user.isAdmin = token.role === "admin";
      return session;
    },
  },

  cookies: { /* unchanged */ },
});

// Extend the type declarations
declare module "next-auth" {
  interface Session {
    user: {
      name?:    string | null;
      email?:   string | null;
      image?:   string | null;
      isAdmin:  boolean;
    };
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    role?: "student" | "teacher" | "admin";
    roleFetchedAt?: number;
  }
}
```

### 5. `src/lib/admin.ts`

Now a one-liner:

```typescript
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
```

### 6. `src/lib/__tests__/admin.test.ts`

Update to reflect the simpler implementation:

```typescript
describe("isAdmin", () => {
  it("returns true when session.user.isAdmin is true", () => {
    expect(isAdmin({ user: { isAdmin: true } } as Session)).toBe(true);
  });

  it("returns false when session.user.isAdmin is false", () => {
    expect(isAdmin({ user: { isAdmin: false } } as Session)).toBe(false);
  });

  it("returns false when session is null", () => {
    expect(isAdmin(null)).toBe(false);
  });
});
```

Remove the old tests that parsed `ADMIN_EMAILS`.

## Acceptance criteria

- [ ] `users.role` is the source of truth for admin status (verified in JWT callback)
- [ ] `ADMIN_EMAILS` is still read **only** for first-time bootstrap of a user whose role is `'student'`
- [ ] Setting a user's role to `'admin'` in the DB grants admin access within 1 hour without re-login
- [ ] Removing a user from `ADMIN_EMAILS` and setting their `role` back to `'student'` revokes admin access within 1 hour
- [ ] `lib/admin.ts` no longer reads env vars
- [ ] `session.user.isAdmin` populated correctly in all routes
- [ ] All existing tests pass with updated assertions

## Test plan

### Existing tests

```bash
pnpm test src/lib/__tests__/admin.test.ts
pnpm test src/lib/__tests__/admin-api-routes.test.ts
```

These will fail until you update the fixtures to provide `session.user.isAdmin` directly.

### New tests in `src/services/__tests__/UserService.test.ts`

```typescript
describe("REFACTOR-P2-02: role bootstrap", () => {
  it("returns 'student' for new users not in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const services = buildTestServices();
    const role = await services.userService.getRoleAndBootstrap("alice@example.com");
    expect(role).toBe("student");
  });

  it("bootstraps a user to 'admin' if their email is in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const services = buildTestServices();
    const role = await services.userService.getRoleAndBootstrap("boss@example.com");
    expect(role).toBe("admin");
  });

  it("does not re-bootstrap if user's role is already 'admin'", async () => {
    process.env.ADMIN_EMAILS = "";  // emptied
    const services = buildTestServices();
    await services.userRepo.setRole("boss@example.com", "admin");
    const role = await services.userService.getRoleAndBootstrap("boss@example.com");
    expect(role).toBe("admin");  // DB wins
  });

  it("does not promote a 'teacher' even if in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "teacher@example.com";
    const services = buildTestServices();
    await services.userRepo.setRole("teacher@example.com", "teacher");
    const role = await services.userService.getRoleAndBootstrap("teacher@example.com");
    expect(role).toBe("teacher");  // No bootstrap from teacher → admin
  });
});
```

### Manual verification

```sql
-- 1. Find a non-admin user
SELECT email, role FROM users WHERE role = 'student' LIMIT 1;

-- 2. Promote them
UPDATE users SET role = 'admin' WHERE email = 'foo@example.com';

-- 3. Have them visit any /admin route in the browser
--    Within 1 hour (or after a reload that triggers a JWT refresh), they should
--    have admin access. No re-login required.

-- 4. Demote
UPDATE users SET role = 'student' WHERE email = 'foo@example.com';
-- Same: within 1 hour, access revoked
```

## Notes / gotchas

- **JWT refresh isn't free.** The `jwt()` callback fires on every request. The hourly cache prevents a DB hit on every request, but does add one DB hit per hour per user. For your scale, negligible.
- **What if a user is malicious and the JWT cache hasn't expired?** They retain admin for up to 1 hour after demotion. Acceptable. If you need immediate revocation, force re-login by changing `AUTH_SECRET` (nukes all sessions globally).
- **`ADMIN_EMAILS` env is still required** for bootstrap and for the very first deploy. Don't remove it from `startup-checks.ts` — but you can leave it empty if all admins are already in DB.
- **`teacher` role unused today.** Schema allows it but no code path treats teachers differently. Leave the type union as `'student' | 'teacher' | 'admin'` for future use.

## Out of scope

- Building an admin UI for role management (use SQL or Supabase Studio for now).
- Adding finer-grained permissions (per-route allow lists). Tutor-only platform; deferred.
- Issuing custom Supabase JWTs based on this role (would enable per-row RLS — see P2-01).
