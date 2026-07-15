/**
 * NextAuth configuration — Google provider, JWT session strategy.
 *
 * Applied fixes:
 *   REFACTOR-R3-P2-03: server-side console.error replaced with structured log(),
 *     so auth failures reach Sentry and carry the request-id correlation.
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { cookies } from "next/headers";
import { userService } from "@/services";
import { log } from "@/lib/logger";

// Extend NextAuth types so session.user.isAdmin is available client-side.
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
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // JWT strategy — no database needed, session stored in a signed cookie
  session: { strategy: "jwt" },

  callbacks: {
    // Register/update the user record in the database on every Google sign-in.
    async signIn({ user }) {
      if (user.email) {
        await userService.ensureUser(
          user.email,
          user.name  ?? undefined,
          user.image ?? undefined,
        );

        // i18n: reconcile users.locale with the NEXT_LOCALE cookie at login.
        // A stored preference wins (delivers cross-device); otherwise we backfill
        // the effective locale (Option B) so background emails work for everyone.
        // Reseed the cookie so the render path (which only reads the cookie) picks
        // up the account's locale immediately. DB is read here, never on render.
        try {
          const cookieStore = await cookies();
          const current = cookieStore.get("NEXT_LOCALE")?.value;
          const cookieLocale = current === "es" || current === "en" ? current : undefined;
          const effective = await userService.seedLocaleOnLogin(user.email, cookieLocale);
          cookieStore.set("NEXT_LOCALE", effective, {
            path:     "/",
            sameSite: "lax",
            maxAge:   60 * 60 * 24 * 365,
          });
        } catch (err) {
          // Locale seeding is best-effort — never block sign-in on it.
          log("error", "Failed to seed locale on login", {
            service: "auth", error: String(err),
          });
        }
      }
      return true;
    },

    // Persist the Google account's email/name/picture into the JWT.
    // REFACTOR-P2-02: Role is fetched from DB once at sign-in and cached in
    // the JWT for the session lifetime. Roles are stable — the only way they
    // change is via bootstrapAdminsFromEnv() on cold start.
    async jwt({ token, profile, trigger }) {
      if (profile) {
        token.email   = profile.email   ?? token.email;
        token.name    = profile.name    ?? token.name;
        token.picture = profile.picture ?? token.picture;
      }

      if (token.email && trigger === "signIn") {
        try {
          token.role = await userService.getRoleAndBootstrap(token.email as string);
        } catch (err) {
          // Don't fail auth if DB is down — fall back to existing role on the
          // token, or 'student' on first run.
          log("error", "Role fetch failed — falling back to cached/student role", {
            service: "auth", error: String(err),
          });
          token.role = token.role ?? "student";
        }
      }

      return token;
    },

    // Expose email, name, and isAdmin on the client-side session object.
    async session({ session, token }) {
      session.user.email = token.email as string;
      session.user.name  = token.name as string;
      session.user.image = (token.picture as string | undefined) ?? null;
      // REFACTOR-P2-02: isAdmin computed from DB-backed role on the token
      session.user.isAdmin = token.role === "admin";
      return session;
    },
  },

  // Keep session alive across browser restarts
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // 30-day persistent cookie
        maxAge: 60 * 60 * 24 * 30,
      },
    },
  },
});
