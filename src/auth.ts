import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { userService } from "@/services";

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
      }
      return true;
    },

    // Persist the Google account's email/name/picture into the JWT
    async jwt({ token, profile }) {
      if (profile) {
        token.email   = profile.email   ?? token.email;
        token.name    = profile.name    ?? token.name;
        token.picture = profile.picture ?? token.picture;
      }
      return token;
    },

    // Expose email, name, and isAdmin on the client-side session object.
    // isAdmin is computed server-side here so the client never needs to read
    // ADMIN_EMAILS directly.
    async session({ session, token }) {
      session.user.email = token.email as string;
      session.user.name  = token.name as string;
      session.user.image = (token.picture as string | undefined) ?? null;
      session.user.isAdmin = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map(e => e.trim().toLowerCase())
        .includes((token.email as string ?? "").toLowerCase());
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
