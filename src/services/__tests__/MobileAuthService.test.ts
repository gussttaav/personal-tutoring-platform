// MOBILE-AUTH-01: service-level tests with a mocked Google verifier + in-memory user repo.
import { MobileAuthService } from "../MobileAuthService";
import { UserService } from "../UserService";
import { InMemoryUserRepository } from "@/__tests__/fixtures/InMemoryUserRepository";
import { InvalidGoogleTokenError, EmailNotVerifiedError } from "@/domain/errors";
import type {
  IGoogleIdTokenVerifier,
  VerifiedGoogleIdentity,
} from "@/infrastructure/google/IGoogleIdTokenVerifier";

function build(verify: jest.Mock) {
  const verifier: IGoogleIdTokenVerifier = { verify };
  const userRepo = new InMemoryUserRepository();
  const userService = new UserService(userRepo);
  const service = new MobileAuthService(verifier, userService);
  return { service, userRepo, userService };
}

const validIdentity: VerifiedGoogleIdentity = {
  email:         "Student@Example.com",
  emailVerified: true,
  name:          "Test Student",
  picture:       "https://avatar/x.png",
};

describe("MobileAuthService.authenticate", () => {
  it("returns a normalized student identity for a verified Google token", async () => {
    const { service } = build(jest.fn().mockResolvedValue(validIdentity));

    const identity = await service.authenticate("good-token");

    expect(identity).toEqual({
      email:   "student@example.com", // normalized
      name:    "Test Student",
      image:   "https://avatar/x.png",
      role:    "student",
      isAdmin: false,
      locale:  null, // not seeded yet — mobile path does not seed
    });
  });

  it("surfaces the stored locale (null when unseeded, es/en when set)", async () => {
    const { service, userService } = build(jest.fn().mockResolvedValue(validIdentity));

    // First sign-in: no locale stored yet → null (read-only, not seeded here).
    const first = await service.authenticate("good-token");
    expect(first.locale).toBeNull();

    // An explicit preference saved later (e.g. via POST /api/locale) is surfaced.
    await userService.setLocale("student@example.com", "en");
    const second = await service.authenticate("good-token");
    expect(second.locale).toBe("en");
  });

  it("registers the user (ensureUser) so mobile maps to the same row as web", async () => {
    const { service, userRepo } = build(jest.fn().mockResolvedValue(validIdentity));

    await service.authenticate("good-token");

    expect(await userRepo.findByEmail("student@example.com")).not.toBeNull();
  });

  it("reports isAdmin:true when the DB role is admin (never trusts the token)", async () => {
    const { service, userRepo } = build(jest.fn().mockResolvedValue({
      ...validIdentity,
      email: "boss@example.com",
    }));
    await userRepo.upsert("boss@example.com");
    await userRepo.setRole("boss@example.com", "admin");

    const identity = await service.authenticate("good-token");

    expect(identity.role).toBe("admin");
    expect(identity.isAdmin).toBe(true);
  });

  it("propagates InvalidGoogleTokenError when verification fails", async () => {
    const { service } = build(jest.fn().mockRejectedValue(new InvalidGoogleTokenError()));

    await expect(service.authenticate("bad-token")).rejects.toBeInstanceOf(InvalidGoogleTokenError);
  });

  it("rejects an unverified email with EmailNotVerifiedError", async () => {
    const { service } = build(jest.fn().mockResolvedValue({
      ...validIdentity,
      emailVerified: false,
    }));

    await expect(service.authenticate("unverified")).rejects.toBeInstanceOf(EmailNotVerifiedError);
  });

  it("does not register a user when the email is unverified", async () => {
    const { service, userRepo } = build(jest.fn().mockResolvedValue({
      ...validIdentity,
      emailVerified: false,
    }));

    await expect(service.authenticate("unverified")).rejects.toBeInstanceOf(EmailNotVerifiedError);
    expect(await userRepo.findByEmail("student@example.com")).toBeNull();
  });
});
