// MOBILE-AUTH-01: getSession() — cookie passthrough + bearer resolution + A2 parity.
//
// next-auth/jwt is ESM-only and not in Jest's transform allowlist, so we mock it
// with a salt-aware fake that faithfully models the real encode/decode contract:
//   - decode of an unknown/tampered token throws (as JWE decryption does);
//   - decode with a salt different from the one used to encode returns null
//     (this is exactly the web-cookie ↔ mobile-bearer partitioning we rely on).
// The real JWE crypto is next-auth's own concern; here we prove getSession's
// branching and the salt contract it depends on.

process.env.AUTH_SECRET = "test-auth-secret-at-least-32-chars-long-xxxx";

jest.mock("next-auth/jwt", () => {
  const store = new Map<string, { token: Record<string, unknown>; salt: string }>();
  let seq = 0;
  return {
    encode: jest.fn(async ({ token, salt, maxAge }: any) => {
      const id = `t${seq++}`;
      store.set(id, {
        token: { ...token, exp: Math.floor(Date.now() / 1000) + (maxAge ?? 0) },
        salt,
      });
      return `enc.${id}`;
    }),
    decode: jest.fn(async ({ token, salt }: any) => {
      const id = typeof token === "string" && token.startsWith("enc.") ? token.slice(4) : null;
      const rec = id ? store.get(id) : undefined;
      if (!rec) throw new Error("JWEDecryptionFailed"); // tampered / unknown
      if (rec.salt !== salt) return null;                // wrong salt → null
      return rec.token;
    }),
  };
});

jest.mock("@/auth", () => ({ auth: jest.fn() }));
jest.mock("next/headers", () => ({ headers: jest.fn() }));

import { encode } from "next-auth/jwt";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { headers } from "next/headers";
import { getSession, mintMobileBearer, MOBILE_BEARER_SALT } from "@/lib/session";
import type { MobileIdentity } from "@/services/MobileAuthService";

const mockAuth = auth as unknown as jest.Mock;
const mockHeaders = headers as unknown as jest.Mock;

function withAuthorization(value: string | null) {
  mockHeaders.mockResolvedValue({ get: (k: string) => (k === "authorization" ? value : null) });
}

const studentIdentity: MobileIdentity = {
  email:   "mobile@example.com",
  name:    "Mobile User",
  image:   "https://p/m.png",
  role:    "student",
  isAdmin: false,
};

beforeEach(() => {
  mockAuth.mockReset();
  mockHeaders.mockReset();
});

describe("getSession — cookie path (zero behavior change)", () => {
  it("returns the auth() session verbatim and never reads the bearer", async () => {
    const cookieSession = { user: { email: "web@example.com", isAdmin: true } } as Session;
    mockAuth.mockResolvedValue(cookieSession);
    withAuthorization("Bearer should-be-ignored");

    const result = await getSession();

    expect(result).toBe(cookieSession); // same reference — untouched
    expect(mockHeaders).not.toHaveBeenCalled();
  });
});

describe("getSession — bearer path", () => {
  it("synthesizes a session field-for-field identical to the cookie shape (A2)", async () => {
    mockAuth.mockResolvedValue(null);
    const bearer = await mintMobileBearer(studentIdentity);
    withAuthorization(`Bearer ${bearer}`);

    const result = await getSession();

    expect(result!.user).toEqual({
      email:   "mobile@example.com",
      name:    "Mobile User",
      image:   "https://p/m.png",
      isAdmin: false,
    });
    expect(typeof result!.expires).toBe("string");
  });

  it("sets isAdmin from the token role, mirroring the session callback", async () => {
    mockAuth.mockResolvedValue(null);
    const bearer = await mintMobileBearer({ ...studentIdentity, role: "admin", isAdmin: true });
    withAuthorization(`Bearer ${bearer}`);

    const result = await getSession();
    expect(result!.user.isAdmin).toBe(true);
  });

  it("returns null when there is no Authorization header", async () => {
    mockAuth.mockResolvedValue(null);
    withAuthorization(null);
    expect(await getSession()).toBeNull();
  });

  it("returns null for a tampered bearer token", async () => {
    mockAuth.mockResolvedValue(null);
    const bearer = await mintMobileBearer(studentIdentity);
    withAuthorization(`Bearer ${bearer}corrupted`);
    expect(await getSession()).toBeNull();
  });

  it("rejects a token minted with the WEB COOKIE salt (salt partitioning)", async () => {
    mockAuth.mockResolvedValue(null);
    // A value valid as a NextAuth cookie must NOT be accepted as a bearer.
    const cookieSalted = await encode({
      token:  { email: "web@example.com", role: "admin", sub: "web@example.com" },
      secret: process.env.AUTH_SECRET!,
      salt:   "authjs.session-token",
      maxAge: 3600,
    });
    withAuthorization(`Bearer ${cookieSalted}`);

    expect(await getSession()).toBeNull();
  });

  it("mints with the mobile salt and round-trips", async () => {
    mockAuth.mockResolvedValue(null);
    expect(MOBILE_BEARER_SALT).toBe("mobile-bearer");
    const bearer = await mintMobileBearer(studentIdentity);
    withAuthorization(`Bearer ${bearer}`);
    expect((await getSession())!.user.email).toBe("mobile@example.com");
  });
});
