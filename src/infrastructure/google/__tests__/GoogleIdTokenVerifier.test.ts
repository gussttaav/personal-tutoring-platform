// MOBILE-AUTH-01: verifier adapter — audience pinning, fail-closed, rejection paths.
import { GoogleIdTokenVerifier } from "../GoogleIdTokenVerifier";
import { InvalidGoogleTokenError } from "@/domain/errors";
import type { OAuth2Client } from "google-auth-library";

function fakeClient(impl: (opts: { idToken: string; audience?: string | string[] }) => unknown) {
  const verifyIdToken = jest.fn(impl);
  // Only the verifyIdToken method is exercised; cast through unknown for the test.
  return { client: { verifyIdToken } as unknown as OAuth2Client, verifyIdToken };
}

const ORIGINAL = process.env.GOOGLE_MOBILE_CLIENT_IDS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.GOOGLE_MOBILE_CLIENT_IDS;
  else process.env.GOOGLE_MOBILE_CLIENT_IDS = ORIGINAL;
});

describe("GoogleIdTokenVerifier", () => {
  it("pins the audience to GOOGLE_MOBILE_CLIENT_IDS and returns the identity", async () => {
    process.env.GOOGLE_MOBILE_CLIENT_IDS = "ios.apps, android.apps ,web.apps";
    const { client, verifyIdToken } = fakeClient(() => ({
      getPayload: () => ({
        email: "u@example.com",
        email_verified: true,
        name: "U",
        picture: "https://p/x.png",
      }),
    }));

    const identity = await new GoogleIdTokenVerifier(client).verify("tok");

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: "tok",
      audience: ["ios.apps", "android.apps", "web.apps"], // trimmed, split
    });
    expect(identity).toEqual({
      email: "u@example.com",
      emailVerified: true,
      name: "U",
      picture: "https://p/x.png",
    });
  });

  it("fails closed (and does NOT verify) when GOOGLE_MOBILE_CLIENT_IDS is unset", async () => {
    delete process.env.GOOGLE_MOBILE_CLIENT_IDS;
    const { client, verifyIdToken } = fakeClient(() => ({ getPayload: () => ({ email: "u@x.com" }) }));

    await expect(new GoogleIdTokenVerifier(client).verify("tok"))
      .rejects.toBeInstanceOf(InvalidGoogleTokenError);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it("rejects when verifyIdToken throws (bad signature / expired / wrong audience)", async () => {
    process.env.GOOGLE_MOBILE_CLIENT_IDS = "ios.apps";
    const { client } = fakeClient(() => { throw new Error("Wrong recipient"); });

    await expect(new GoogleIdTokenVerifier(client).verify("tok"))
      .rejects.toBeInstanceOf(InvalidGoogleTokenError);
  });

  it("rejects when the payload has no email", async () => {
    process.env.GOOGLE_MOBILE_CLIENT_IDS = "ios.apps";
    const { client } = fakeClient(() => ({ getPayload: () => ({ email_verified: true }) }));

    await expect(new GoogleIdTokenVerifier(client).verify("tok"))
      .rejects.toBeInstanceOf(InvalidGoogleTokenError);
  });

  it("reports emailVerified:false when Google says so", async () => {
    process.env.GOOGLE_MOBILE_CLIENT_IDS = "ios.apps";
    const { client } = fakeClient(() => ({
      getPayload: () => ({ email: "u@x.com", email_verified: false }),
    }));

    const identity = await new GoogleIdTokenVerifier(client).verify("tok");
    expect(identity.emailVerified).toBe(false);
  });
});
