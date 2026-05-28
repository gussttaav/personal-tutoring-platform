import { InMemoryBookingRepository } from "./InMemoryBookingRepository";

describe("InMemoryBookingRepository.listDuePendingTerminations", () => {
  const realNow = Date.now;
  afterEach(() => { Date.now = realNow; });

  it("returns only due rows whose attempts are below maxAttempts, ordered by fire_at ascending", async () => {
    const repo = new InMemoryBookingRepository();
    const now  = 1_700_000_000_000;
    Date.now   = () => now;

    await repo.recordPendingTermination("evt-late",   now + 60_000); // not due yet
    await repo.recordPendingTermination("evt-second", now - 30_000); // due, fires second
    await repo.recordPendingTermination("evt-first",  now - 60_000); // due, fires first
    await repo.recordPendingTermination("evt-burned", now - 90_000); // due but exhausted attempts
    await repo.recordPendingTerminationFailure("evt-burned", 5, "boom");

    const due = await repo.listDuePendingTerminations(50, 5);

    expect(due.map(r => r.eventId)).toEqual(["evt-first", "evt-second"]);
    expect(due.every(r => r.attempts < 5)).toBe(true);
  });
});
