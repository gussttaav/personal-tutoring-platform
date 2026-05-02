import { SubscriptionService } from "../SubscriptionService";
import type { ISubscriptionRepository } from "@/domain/repositories/ISubscriptionRepository";
import { AlreadySubscribedError } from "@/domain/errors";

const mockSubs = (): jest.Mocked<ISubscriptionRepository> => ({
  subscribe:    jest.fn(),
  isSubscribed: jest.fn(),
});

describe("SubscriptionService.subscribe", () => {
  it("calls repo.subscribe when not yet subscribed", async () => {
    const subs = mockSubs();
    subs.isSubscribed.mockResolvedValue(false);
    subs.subscribe.mockResolvedValue(undefined);

    const service = new SubscriptionService(subs);
    await service.subscribe("user@example.com", "courses");

    expect(subs.isSubscribed).toHaveBeenCalledWith("user@example.com", "courses");
    expect(subs.subscribe).toHaveBeenCalledWith("user@example.com", "courses");
  });

  it("throws AlreadySubscribedError when already subscribed", async () => {
    const subs = mockSubs();
    subs.isSubscribed.mockResolvedValue(true);

    const service = new SubscriptionService(subs);

    await expect(service.subscribe("user@example.com", "blog"))
      .rejects.toThrow(AlreadySubscribedError);

    expect(subs.subscribe).not.toHaveBeenCalled();
  });

  it("works for both subscription types", async () => {
    for (const type of ["courses", "blog"] as const) {
      const subs = mockSubs();
      subs.isSubscribed.mockResolvedValue(false);
      subs.subscribe.mockResolvedValue(undefined);

      await new SubscriptionService(subs).subscribe("a@b.com", type);

      expect(subs.subscribe).toHaveBeenCalledWith("a@b.com", type);
    }
  });
});

describe("SubscriptionService.isSubscribed", () => {
  it("returns true when subscribed", async () => {
    const subs = mockSubs();
    subs.isSubscribed.mockResolvedValue(true);

    const result = await new SubscriptionService(subs).isSubscribed("user@example.com", "courses");

    expect(result).toBe(true);
    expect(subs.isSubscribed).toHaveBeenCalledWith("user@example.com", "courses");
  });

  it("returns false when not subscribed", async () => {
    const subs = mockSubs();
    subs.isSubscribed.mockResolvedValue(false);

    const result = await new SubscriptionService(subs).isSubscribed("user@example.com", "blog");

    expect(result).toBe(false);
  });
});
