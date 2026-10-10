import { SubscriptionService } from "../SubscriptionService";
import { UserService }         from "../UserService";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import { AlreadySubscribedError } from "@/domain/errors";

const TEST_USER_ID = "user-uuid-sub-test";

const mockSubs = (): jest.Mocked<ISubscriptionRepository> => ({
  subscribe:    jest.fn(),
  isSubscribed: jest.fn(),
  getAreas:     jest.fn(),
  updateAreas:  jest.fn(),
  unsubscribe:  jest.fn(),
  listByType:   jest.fn(),
});

const mockUserService = (): jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">> => ({
  ensureUser:  jest.fn().mockResolvedValue(TEST_USER_ID),
  findByEmail: jest.fn().mockResolvedValue({ id: TEST_USER_ID }),
});

function makeService(
  subsOverrides:    Partial<jest.Mocked<ISubscriptionRepository>> = {},
  userSvcOverrides: Partial<jest.Mocked<Pick<UserService, "ensureUser" | "findByEmail">>> = {},
) {
  const subs    = { ...mockSubs(),        ...subsOverrides };
  const userSvc = { ...mockUserService(), ...userSvcOverrides };
  const service = new SubscriptionService(subs, userSvc as unknown as UserService);
  return { service, subs, userSvc };
}

describe("SubscriptionService.subscribe", () => {
  it("ensures user exists then calls repo.subscribe with userId", async () => {
    const { service, subs, userSvc } = makeService();
    subs.isSubscribed.mockResolvedValue(false);
    subs.subscribe.mockResolvedValue(undefined);

    await service.subscribe("user@example.com", "courses");

    expect(userSvc.ensureUser).toHaveBeenCalledWith("user@example.com");
    expect(subs.isSubscribed).toHaveBeenCalledWith(TEST_USER_ID, "courses");
    expect(subs.subscribe).toHaveBeenCalledWith(TEST_USER_ID, "courses", null);
  });

  it("throws AlreadySubscribedError when already subscribed", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(true);

    await expect(service.subscribe("user@example.com", "blog"))
      .rejects.toThrow(AlreadySubscribedError);

    expect(subs.subscribe).not.toHaveBeenCalled();
  });

  it("works for both subscription types", async () => {
    for (const type of ["courses", "blog"] as const) {
      const { service, subs } = makeService();
      subs.isSubscribed.mockResolvedValue(false);
      subs.subscribe.mockResolvedValue(undefined);

      await service.subscribe("a@b.com", type);

      // No areas sent: courses have none, and the blog means "every area".
      expect(subs.subscribe).toHaveBeenCalledWith(TEST_USER_ID, type, null);
    }
  });

  // BLOG-15
  it("stores a blog subset normalized: known areas, display order, no duplicates", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(false);

    await service.subscribe("a@b.com", "blog", ["matematicas", "ia", "ia"]);

    expect(subs.subscribe).toHaveBeenCalledWith(TEST_USER_ID, "blog", ["ia", "matematicas"]);
  });

  it("stores every blog area as null, so a future area is included", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(false);

    await service.subscribe("a@b.com", "blog", ["programacion", "matematicas", "bases-de-datos", "ia"]);

    expect(subs.subscribe).toHaveBeenCalledWith(TEST_USER_ID, "blog", null);
  });

  it("ignores areas on a courses subscription", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(false);

    await service.subscribe("a@b.com", "courses", ["ia"]);

    expect(subs.subscribe).toHaveBeenCalledWith(TEST_USER_ID, "courses", null);
  });
});

// BLOG-15 — the notify card's one status read.
describe("SubscriptionService.getStatus", () => {
  it("reports a subscriber with their areas", async () => {
    const { service, subs } = makeService();
    subs.getAreas.mockResolvedValue(["ia"]);

    await expect(service.getStatus("user@example.com", "blog"))
      .resolves.toEqual({ subscribed: true, areas: ["ia"] });
    expect(subs.getAreas).toHaveBeenCalledWith(TEST_USER_ID, "blog");
  });

  it("reports a subscriber of every area as areas: null", async () => {
    const { service, subs } = makeService();
    subs.getAreas.mockResolvedValue(null);

    await expect(service.getStatus("user@example.com", "blog"))
      .resolves.toEqual({ subscribed: true, areas: null });
  });

  it("reports not subscribed when there is no row", async () => {
    const { service, subs } = makeService();
    subs.getAreas.mockResolvedValue(undefined);

    await expect(service.getStatus("user@example.com", "blog"))
      .resolves.toEqual({ subscribed: false, areas: null });
  });

  it("reports not subscribed for an unknown user without creating one", async () => {
    const { service, subs, userSvc } = makeService({}, { findByEmail: jest.fn().mockResolvedValue(null) });

    await expect(service.getStatus("unknown@example.com", "courses"))
      .resolves.toEqual({ subscribed: false, areas: null });
    expect(subs.getAreas).not.toHaveBeenCalled();
    expect(userSvc.ensureUser).not.toHaveBeenCalled();
  });
});

describe("SubscriptionService.updateBlogAreas", () => {
  it("updates the blog subscription with the normalized selection", async () => {
    const { service, subs } = makeService();
    subs.updateAreas.mockResolvedValue(true);

    await expect(service.updateBlogAreas("user@example.com", ["programacion", "ia"])).resolves.toBe(true);
    expect(subs.updateAreas).toHaveBeenCalledWith(TEST_USER_ID, "blog", ["ia", "programacion"]);
  });

  it("stores every area as null", async () => {
    const { service, subs } = makeService();
    subs.updateAreas.mockResolvedValue(true);

    await service.updateBlogAreas("user@example.com", ["ia", "bases-de-datos", "matematicas", "programacion"]);

    expect(subs.updateAreas).toHaveBeenCalledWith(TEST_USER_ID, "blog", null);
  });

  it("returns false when the reader is not subscribed", async () => {
    const { service, subs } = makeService();
    subs.updateAreas.mockResolvedValue(false);

    await expect(service.updateBlogAreas("user@example.com", ["ia"])).resolves.toBe(false);
  });

  it("returns false for an unknown user without creating one", async () => {
    const { service, subs, userSvc } = makeService({}, { findByEmail: jest.fn().mockResolvedValue(null) });

    await expect(service.updateBlogAreas("unknown@example.com", ["ia"])).resolves.toBe(false);
    expect(subs.updateAreas).not.toHaveBeenCalled();
    expect(userSvc.ensureUser).not.toHaveBeenCalled();
  });
});

describe("SubscriptionService.isSubscribed", () => {
  it("returns true when subscribed", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(true);

    const result = await service.isSubscribed("user@example.com", "courses");

    expect(result).toBe(true);
    expect(subs.isSubscribed).toHaveBeenCalledWith(TEST_USER_ID, "courses");
  });

  it("returns false when not subscribed", async () => {
    const { service, subs } = makeService();
    subs.isSubscribed.mockResolvedValue(false);

    const result = await service.isSubscribed("user@example.com", "blog");

    expect(result).toBe(false);
  });

  it("returns false when user does not exist", async () => {
    const { service, subs } = makeService({}, { findByEmail: jest.fn().mockResolvedValue(null) });

    const result = await service.isSubscribed("unknown@example.com", "courses");

    expect(result).toBe(false);
    expect(subs.isSubscribed).not.toHaveBeenCalled();
  });
});

// COURSE-P6-02 — the notify card's toggle and the announce email's unsubscribe link.
describe("SubscriptionService.unsubscribe", () => {
  it("resolves the user then calls repo.unsubscribe with userId", async () => {
    const { service, subs, userSvc } = makeService();

    await service.unsubscribe("user@example.com", "courses");

    expect(userSvc.findByEmail).toHaveBeenCalledWith("user@example.com");
    expect(subs.unsubscribe).toHaveBeenCalledWith(TEST_USER_ID, "courses");
  });

  it("is a no-op for a user that does not exist — never creates one", async () => {
    const { service, subs, userSvc } = makeService(
      {},
      { findByEmail: jest.fn().mockResolvedValue(null) },
    );

    await expect(service.unsubscribe("unknown@example.com", "courses")).resolves.toBeUndefined();

    expect(subs.unsubscribe).not.toHaveBeenCalled();
    expect(userSvc.ensureUser).not.toHaveBeenCalled();
  });

  it("does not throw when there was nothing to remove", async () => {
    const { service, subs } = makeService();
    subs.unsubscribe.mockResolvedValue(undefined);

    await expect(service.unsubscribe("user@example.com", "blog")).resolves.toBeUndefined();
  });
});

describe("SubscriptionService.listSubscribers", () => {
  it("passes the type through to the repository", async () => {
    const { service, subs } = makeService();
    subs.listByType.mockResolvedValue([
      { userId: TEST_USER_ID, email: "a@b.com", locale: "en", areas: null },
    ]);

    const recipients = await service.listSubscribers("courses");

    expect(subs.listByType).toHaveBeenCalledWith("courses");
    expect(recipients).toEqual([{ userId: TEST_USER_ID, email: "a@b.com", locale: "en", areas: null }]);
  });
});
