import { UserService } from "../UserService";
import type { IUserRepository } from "@/domain/repositories/IUserRepository";
import { InMemoryUserRepository } from "@/__tests__/fixtures/InMemoryUserRepository";

const mockRepo = (): jest.Mocked<IUserRepository> => ({
  upsert:       jest.fn(),
  findByEmail:  jest.fn(),
  getRole:      jest.fn(),
  setRole:      jest.fn(),
  getLocale:    jest.fn(),
  setLocale:    jest.fn(),
  deleteAccount: jest.fn(),
});

describe("UserService.ensureUser", () => {
  it("delegates to IUserRepository.upsert and returns the id", async () => {
    const repo = mockRepo();
    repo.upsert.mockResolvedValue("uuid-abc-123");

    const service = new UserService(repo);
    const id = await service.ensureUser("Test@Example.com", "Test User", "https://avatar.url");

    expect(repo.upsert).toHaveBeenCalledWith("Test@Example.com", "Test User", "https://avatar.url");
    expect(id).toBe("uuid-abc-123");
  });

  it("passes undefined name and avatarUrl when omitted", async () => {
    const repo = mockRepo();
    repo.upsert.mockResolvedValue("uuid-def-456");

    await new UserService(repo).ensureUser("a@b.com");

    expect(repo.upsert).toHaveBeenCalledWith("a@b.com", undefined, undefined);
  });
});

describe("UserService.findByEmail", () => {
  it("returns the user id when found", async () => {
    const repo = mockRepo();
    repo.findByEmail.mockResolvedValue({ id: "uuid-found" });

    const result = await new UserService(repo).findByEmail("user@example.com");

    expect(repo.findByEmail).toHaveBeenCalledWith("user@example.com");
    expect(result).toEqual({ id: "uuid-found" });
  });

  it("returns null when user does not exist", async () => {
    const repo = mockRepo();
    repo.findByEmail.mockResolvedValue(null);

    const result = await new UserService(repo).findByEmail("ghost@example.com");

    expect(result).toBeNull();
  });
});

// ─── getRoleAndBootstrap / bootstrapAdminsFromEnv ─────────────────────────────

function buildTestServices() {
  const userRepo = new InMemoryUserRepository();
  const userService = new UserService(userRepo);
  return { userRepo, userService };
}

describe("REFACTOR-P2-02: getRoleAndBootstrap", () => {
  it("returns 'student' for a new user", async () => {
    const { userService } = buildTestServices();
    const role = await userService.getRoleAndBootstrap("alice@example.com");
    expect(role).toBe("student");
  });

  it("returns the existing DB role for a known user", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("boss@example.com");
    await userRepo.setRole("boss@example.com", "admin");
    const role = await userService.getRoleAndBootstrap("boss@example.com");
    expect(role).toBe("admin");
  });
});

describe("REFACTOR-P2-02: bootstrapAdminsFromEnv", () => {
  afterEach(() => { delete process.env.ADMIN_EMAILS; });

  it("promotes an existing student if their email is in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("boss@example.com");
    await userService.bootstrapAdminsFromEnv();
    expect(await userRepo.getRole("boss@example.com")).toBe("admin");
  });

  it("creates and promotes a user who doesn't exist in the DB yet", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { userRepo, userService } = buildTestServices();
    await userService.bootstrapAdminsFromEnv();
    expect(await userRepo.getRole("boss@example.com")).toBe("admin");
  });

  it("does not change the role of an existing admin", async () => {
    process.env.ADMIN_EMAILS = "boss@example.com";
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("boss@example.com");
    await userRepo.setRole("boss@example.com", "admin");
    await userService.bootstrapAdminsFromEnv();
    expect(await userRepo.getRole("boss@example.com")).toBe("admin");
  });

  it("does not promote a teacher even if in ADMIN_EMAILS", async () => {
    process.env.ADMIN_EMAILS = "teacher@example.com";
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("teacher@example.com");
    await userRepo.setRole("teacher@example.com", "teacher");
    await userService.bootstrapAdminsFromEnv();
    expect(await userRepo.getRole("teacher@example.com")).toBe("teacher");
  });

  it("does nothing when ADMIN_EMAILS is empty", async () => {
    process.env.ADMIN_EMAILS = "";
    const { userService } = buildTestServices();
    await expect(userService.bootstrapAdminsFromEnv()).resolves.toBeUndefined();
  });
});

// ─── i18n: locale preference (getLocale / setLocale / seedLocaleOnLogin) ───────

describe("UserService locale preference", () => {
  it("setLocale then getLocale round-trips (explicit switch persists to DB)", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("switcher@example.com");

    await userService.setLocale("Switcher@Example.com", "en");

    expect(await userService.getLocale("switcher@example.com")).toBe("en");
  });

  it("getLocale returns null when no preference is stored", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("fresh@example.com");
    expect(await userService.getLocale("fresh@example.com")).toBeNull();
  });

  it("setLocale normalizes the email before persisting", async () => {
    const repo = mockRepo();
    await new UserService(repo).setLocale("  Mixed@Case.COM ", "es");
    expect(repo.setLocale).toHaveBeenCalledWith("mixed@case.com", "es");
  });
});

describe("UserService.seedLocaleOnLogin", () => {
  it("returns the stored locale when set, ignoring the cookie (DB wins → cross-device)", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("traveler@example.com");
    await userRepo.setLocale("traveler@example.com", "en");

    // Second device's cookie defaults to Spanish; the account must still win.
    const result = await userService.seedLocaleOnLogin("traveler@example.com", "es");

    expect(result).toBe("en");
    expect(await userRepo.getLocale("traveler@example.com")).toBe("en");
  });

  it("account wins at login even after an anonymous switch (no timestamps)", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("owner@example.com");
    await userRepo.setLocale("owner@example.com", "es");

    // Anonymous user switched to English (cookie 'en'), then logs into a Spanish account.
    const result = await userService.seedLocaleOnLogin("owner@example.com", "en");

    expect(result).toBe("es"); // DB wins; one switcher click would correct it.
  });

  it("backfills NULL from the effective cookie locale (Option B)", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("newuser@example.com"); // locale NULL

    const result = await userService.seedLocaleOnLogin("newuser@example.com", "en");

    expect(result).toBe("en");
    expect(await userRepo.getLocale("newuser@example.com")).toBe("en");
  });

  it("backfills NULL to 'es' when there is no cookie", async () => {
    const { userRepo, userService } = buildTestServices();
    await userRepo.upsert("nocookie@example.com"); // locale NULL

    const result = await userService.seedLocaleOnLogin("nocookie@example.com");

    expect(result).toBe("es");
    expect(await userRepo.getLocale("nocookie@example.com")).toBe("es");
  });
});
