// DB-02: Integration tests for SupabaseBookingRepository.
// REFACTOR-R4-P1-01: hasActiveFreeSession.
// REFACTOR-R4-P1-02: hasBookingForPayment with two rows (one cancelled) for one PaymentIntent.
// REFACTOR-R4-P1-03: reinstateBooking (original tokens back; false on a re-taken slot) and
// findByCancelToken returning stripePaymentId.
// REFACTOR-R4-P1-04: cancelByToken (cancel_booking RPC) — originating pack first, then the
// earliest-expiring active pack with room, then nothing; non-pack; concurrency.
// REFACTOR-R4-P3-03: listUpcomingForPaymentAudit — status and time filter, the pack owner
// and PaymentIntent join, normalized timestamps.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseBookingRepository } from "../SupabaseBookingRepository";
import { supabase } from "../client";
import { uniqueFutureSlot, purgeTestUsers } from "./slot-helpers";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

// Every test here makes serial round trips to the remote test database. The
// payment-audit test alone makes ~40 of them and takes ~4.9 s on an idle run,
// just under Jest's 5 s default, so the full parallel `test:unit` run pushed
// it over intermittently. The unit project keeps the default for everything else.
jest.setTimeout(20_000);

const TEST_EMAIL_PATTERN = "test-booking-%@example.com";

let recordSeq = 0;
const baseRecord = () => {
  const { startIso, endIso } = uniqueFutureSlot();
  const uid = `${Date.now()}-${recordSeq++}`;
  return {
    eventId:     `evt-${uid}`,
    email:       `test-booking-${uid}@example.com`,
    name:        "Test Student",
    sessionType: "session1h" as const,
    startsAt:    startIso,
    endsAt:      endIso,
  };
};

describeDb("SupabaseBookingRepository", () => {
  const repo = new SupabaseBookingRepository();

  // Clear any rows left by a prior failed run so the exclusion constraint
  // (bookings_no_overlap) can't be tripped by stale confirmed bookings.
  beforeAll(() => purgeTestUsers(TEST_EMAIL_PATTERN));
  afterAll(() => purgeTestUsers(TEST_EMAIL_PATTERN));

  async function cleanup(email: string) {
    const { data: user } = await supabase
      .from("users").select("id").eq("email", email).maybeSingle();
    if (user) {
      await supabase.from("bookings").delete().eq("user_id", user.id);
      await supabase.from("users").delete().eq("id", user.id);
    }
  }

  it("createBooking returns cancelToken and joinToken", async () => {
    const record = baseRecord();
    const { cancelToken, joinToken } = await repo.createBooking(record);

    expect(cancelToken).toMatch(/^[0-9a-f]{64}$/);
    expect(joinToken).toMatch(/^[0-9a-f]{64}$/);
    expect(cancelToken).not.toBe(joinToken);

    await cleanup(record.email);
  });

  it("findByCancelToken returns record for valid token", async () => {
    const record = baseRecord();
    const { cancelToken } = await repo.createBooking(record);

    const found = await repo.findByCancelToken(cancelToken);
    expect(found).not.toBeNull();
    expect(found!.eventId).toBe(record.eventId);
    expect(found!.email).toBe(record.email);
    expect(found!.used).toBe(false);

    await cleanup(record.email);
  });

  it("findByCancelToken returns null for malformed token", async () => {
    const result = await repo.findByCancelToken("not-a-valid-hex-token");
    expect(result).toBeNull();
  });

  it("findByJoinToken returns eventId and email", async () => {
    const record = baseRecord();
    const { joinToken } = await repo.createBooking(record);

    const found = await repo.findByJoinToken(joinToken);
    expect(found).not.toBeNull();
    expect(found!.eventId).toBe(record.eventId);
    expect(found!.email).toBe(record.email);

    await cleanup(record.email);
  });

  it("consumeCancelToken returns true first time, false on double-consume", async () => {
    const record = baseRecord();
    const { cancelToken } = await repo.createBooking(record);

    const first  = await repo.consumeCancelToken(cancelToken);
    const second = await repo.consumeCancelToken(cancelToken);

    expect(first).toBe(true);
    expect(second).toBe(false);

    await cleanup(record.email);
  });

  it("listByUser excludes cancelled bookings", async () => {
    const record = baseRecord();
    const { cancelToken } = await repo.createBooking(record);

    let list = await repo.listByUser(record.email);
    expect(list.length).toBe(1);

    await repo.consumeCancelToken(cancelToken);

    list = await repo.listByUser(record.email);
    expect(list.length).toBe(0);

    await cleanup(record.email);
  });

  it("hasAnyBooking returns false for unknown user", async () => {
    const result = await repo.hasAnyBooking(`no-one-${Date.now()}@example.com`);
    expect(result).toBe(false);
  });

  it("hasAnyBooking returns true after a booking is created", async () => {
    const record = baseRecord();
    await repo.createBooking(record);

    const result = await repo.hasAnyBooking(record.email);
    expect(result).toBe(true);

    await cleanup(record.email);
  });

  it("hasAnyBooking still returns true after the only booking is cancelled", async () => {
    const record = baseRecord();
    const { cancelToken } = await repo.createBooking(record);
    await repo.consumeCancelToken(cancelToken);

    const result = await repo.hasAnyBooking(record.email);
    expect(result).toBe(true);

    await cleanup(record.email);
  });

  // REFACTOR-R4-P1-01: the free-call cap counts non-cancelled free15min rows only.
  it("hasActiveFreeSession returns false for unknown user", async () => {
    const result = await repo.hasActiveFreeSession(`no-one-${Date.now()}@example.com`);
    expect(result).toBe(false);
  });

  it("hasActiveFreeSession returns true for a confirmed free15min booking", async () => {
    const record = { ...baseRecord(), sessionType: "free15min" as const };
    await repo.createBooking(record);

    expect(await repo.hasActiveFreeSession(record.email)).toBe(true);

    await cleanup(record.email);
  });

  it("hasActiveFreeSession returns false once the free call is cancelled", async () => {
    const record = { ...baseRecord(), sessionType: "free15min" as const };
    const { cancelToken } = await repo.createBooking(record);
    await repo.consumeCancelToken(cancelToken);

    expect(await repo.hasActiveFreeSession(record.email)).toBe(false);

    await cleanup(record.email);
  });

  it("hasActiveFreeSession ignores paid bookings", async () => {
    const record = baseRecord(); // session1h
    await repo.createBooking(record);

    expect(await repo.hasActiveFreeSession(record.email)).toBe(false);

    await cleanup(record.email);
  });

  // REFACTOR-R4-P1-02: a rescheduled paid class leaves the old row (cancelled) and the
  // new one (confirmed) sharing the PaymentIntent. .maybeSingle() errored on that; the
  // count answers true — and false for a PaymentIntent with no row at all.
  it("hasBookingForPayment is true for two bookings (one cancelled) sharing a PaymentIntent", async () => {
    const stripePaymentId = `pi_test_${Date.now()}_${recordSeq}`;
    const original        = { ...baseRecord(), stripePaymentId };
    const { cancelToken } = await repo.createBooking(original);
    await repo.consumeCancelToken(cancelToken);
    await repo.createBooking({ ...baseRecord(), email: original.email, stripePaymentId });

    expect(await repo.hasBookingForPayment(stripePaymentId)).toBe(true);
    expect(await repo.hasBookingForPayment(`${stripePaymentId}_none`)).toBe(false);

    await cleanup(original.email);
  });

  // REFACTOR-R4-P1-03: a reschedule's claim compensation.
  it("reinstateBooking brings a consumed booking back with its ORIGINAL tokens", async () => {
    const record = baseRecord();
    const { cancelToken, joinToken } = await repo.createBooking(record);
    const claimed = await repo.findByCancelToken(cancelToken);
    expect(claimed).not.toBeNull();

    await repo.consumeCancelToken(cancelToken);
    expect(await repo.findByCancelToken(cancelToken)).toBeNull();

    // `claimed.startsAt` is the normalized toISOString() form — the token recomputes exactly.
    expect(await repo.reinstateBooking(claimed!)).toBe(true);
    expect(await repo.findByCancelToken(cancelToken)).toMatchObject({ eventId: record.eventId });
    expect(await repo.findByJoinToken(joinToken)).toMatchObject({ eventId: record.eventId });
    expect((await repo.findByEventId(record.eventId))?.status).toBe("confirmed");

    await cleanup(record.email);
  });

  it("reinstateBooking returns false for a booking that is not cancelled", async () => {
    const record = baseRecord();
    const { cancelToken } = await repo.createBooking(record);
    const found = await repo.findByCancelToken(cancelToken);

    expect(await repo.reinstateBooking(found!)).toBe(false);

    await cleanup(record.email);
  });

  it("reinstateBooking returns false when another confirmed booking took the slot", async () => {
    const original = baseRecord();
    const { cancelToken } = await repo.createBooking(original);
    const claimed = await repo.findByCancelToken(cancelToken);
    await repo.consumeCancelToken(cancelToken);

    // Someone else books the freed slot; bookings_no_overlap now rejects the reinstate (23P01).
    const taker = { ...baseRecord(), startsAt: original.startsAt, endsAt: original.endsAt };
    await repo.createBooking(taker);

    expect(await repo.reinstateBooking(claimed!)).toBe(false);
    expect((await repo.findByEventId(original.eventId))?.status).toBe("cancelled");

    await cleanup(original.email);
    await cleanup(taker.email);
  });

  it("findByCancelToken returns the booking's stripePaymentId", async () => {
    const stripePaymentId = `pi_test_${Date.now()}_${recordSeq}_fct`;
    const record = { ...baseRecord(), stripePaymentId };
    const { cancelToken } = await repo.createBooking(record);

    expect(await repo.findByCancelToken(cancelToken)).toMatchObject({ stripePaymentId });

    await cleanup(record.email);
  });

  // ─── REFACTOR-R4-P1-04: cancelByToken (cancel_booking RPC) ────────────────
  describe("cancelByToken", () => {
    const DAY_MS = 86_400_000;
    const inDays = (d: number) => new Date(Date.now() + d * DAY_MS).toISOString();

    async function seedUser(email: string): Promise<string> {
      const { data, error } = await supabase
        .from("users").upsert({ email, name: "Test Student" }, { onConflict: "email" })
        .select("id").single();
      if (error) throw error;
      return data.id;
    }

    async function seedPack(userId: string, expiresAt: string, creditsRemaining: number): Promise<string> {
      const { data, error } = await supabase.from("credit_packs").insert({
        user_id:           userId,
        pack_size:         5,
        credits_remaining: creditsRemaining,
        stripe_payment_id: `pi_test_cancel_${Date.now()}_${recordSeq++}`,
        expires_at:        expiresAt,
      }).select("id").single();
      if (error) throw error;
      return data.id;
    }

    async function remaining(packId: string): Promise<number> {
      const { data } = await supabase
        .from("credit_packs").select("credits_remaining").eq("id", packId).single();
      return data!.credits_remaining;
    }

    // bookings.credit_pack_id → credit_packs → users, so packs go between the two.
    async function cleanupWithPacks(email: string) {
      const { data: user } = await supabase
        .from("users").select("id").eq("email", email).maybeSingle();
      if (!user) return;
      await supabase.from("bookings").delete().eq("user_id", user.id);
      await supabase.from("credit_packs").delete().eq("user_id", user.id);
      await supabase.from("users").delete().eq("id", user.id);
    }

    const packBooking = (email: string, creditPackId?: string) => ({
      ...baseRecord(), email, sessionType: "pack" as const,
      ...(creditPackId ? { creditPackId } : {}),
    });

    it("restores to the originating pack, else the earliest-expiring one, else reports nothing", async () => {
      const { email } = baseRecord();
      const userId = await seedUser(email);
      const packA  = await seedPack(userId, inDays(180), 3); // the booking's pack
      const packB  = await seedPack(userId, inDays(10), 3);  // expires sooner, has room

      try {
        // 1. B expires first, but the class was paid from A — the credit goes back to A.
        const first = await repo.createBooking(packBooking(email, packA));
        expect(await repo.cancelByToken(first.cancelToken)).toEqual({
          consumed: true, restored: true, restoredPackId: packA, fromOriginating: true, credits: 7,
        });
        expect(await remaining(packA)).toBe(4);
        expect(await remaining(packB)).toBe(3);

        // 2. A has expired since the booking → fall back to B.
        await supabase.from("credit_packs").update({ expires_at: inDays(-1) }).eq("id", packA);
        const second = await repo.createBooking(packBooking(email, packA));
        expect(await repo.cancelByToken(second.cancelToken)).toEqual({
          consumed: true, restored: true, restoredPackId: packB, fromOriginating: false, credits: 4,
        });
        expect(await remaining(packB)).toBe(4);

        // 3. B is full too → nothing restored, and the result says so. Still cancelled.
        await supabase.from("credit_packs").update({ credits_remaining: 5 }).eq("id", packB);
        const thirdRecord = packBooking(email, packA);
        const third = await repo.createBooking(thirdRecord);
        expect(await repo.cancelByToken(third.cancelToken)).toEqual({
          consumed: true, restored: false, restoredPackId: null, fromOriginating: false, credits: 5,
        });
        expect(await remaining(packA)).toBe(4);
        expect(await remaining(packB)).toBe(5);
        expect((await repo.findByEventId(thirdRecord.eventId))?.status).toBe("cancelled");
      } finally {
        await cleanupWithPacks(email);
      }
    });

    it("a legacy pack booking with no pack link restores to the earliest-expiring pack with room", async () => {
      const { email } = baseRecord();
      const userId = await seedUser(email);
      await seedPack(userId, inDays(90), 2);
      const sooner = await seedPack(userId, inDays(30), 2);

      try {
        const { cancelToken } = await repo.createBooking(packBooking(email));
        expect(await repo.cancelByToken(cancelToken)).toEqual({
          consumed: true, restored: true, restoredPackId: sooner, fromOriginating: false, credits: 5,
        });
        expect(await remaining(sooner)).toBe(3);
      } finally {
        await cleanupWithPacks(email);
      }
    });

    it("a non-pack cancel restores nothing and leaves the packs alone", async () => {
      const record = baseRecord(); // session1h
      const userId = await seedUser(record.email);
      const pack   = await seedPack(userId, inDays(90), 2);

      try {
        const { cancelToken } = await repo.createBooking(record);
        expect(await repo.cancelByToken(cancelToken)).toEqual({
          consumed: true, restored: false, restoredPackId: null, fromOriginating: false, credits: 2,
        });
        expect(await remaining(pack)).toBe(2);
        expect((await repo.findByEventId(record.eventId))?.status).toBe("cancelled");
      } finally {
        await cleanupWithPacks(record.email);
      }
    });

    it("two concurrent cancels with the same token: exactly one consumes, one credit restored", async () => {
      const { email } = baseRecord();
      const userId = await seedUser(email);
      const pack   = await seedPack(userId, inDays(90), 2);

      try {
        const { cancelToken } = await repo.createBooking(packBooking(email, pack));
        const results = await Promise.all([repo.cancelByToken(cancelToken), repo.cancelByToken(cancelToken)]);

        expect(results.filter(r => r.consumed)).toHaveLength(1);
        expect(results.filter(r => r.restored)).toHaveLength(1);
        expect(await remaining(pack)).toBe(3);
      } finally {
        await cleanupWithPacks(email);
      }
    });

    it("an unknown or malformed token consumes nothing", async () => {
      const none = { consumed: false, restored: false, restoredPackId: null, fromOriginating: false, credits: 0 };
      expect(await repo.cancelByToken("not-a-valid-hex-token")).toEqual(none);
      expect(await repo.cancelByToken("0".repeat(64))).toEqual(none);
    });
  });

  // ─── REFACTOR-R4-P3-03: listUpcomingForPaymentAudit ───────────────────────
  describe("listUpcomingForPaymentAudit", () => {
    const DAY_MS = 86_400_000;

    async function seedUser(email: string): Promise<string> {
      const { data, error } = await supabase
        .from("users").upsert({ email, name: "Test Student" }, { onConflict: "email" })
        .select("id").single();
      if (error) throw error;
      return data.id;
    }

    async function seedPack(userId: string, stripePaymentId: string): Promise<string> {
      const { data, error } = await supabase.from("credit_packs").insert({
        user_id:           userId,
        pack_size:         5,
        credits_remaining: 3,
        stripe_payment_id: stripePaymentId,
        expires_at:        new Date(Date.now() + 180 * DAY_MS).toISOString(),
      }).select("id").single();
      if (error) throw error;
      return data.id;
    }

    async function bookingId(eventId: string): Promise<string> {
      const found = await repo.findByEventId(eventId);
      if (!found) throw new Error(`no booking for ${eventId}`);
      return found.id;
    }

    // bookings.credit_pack_id → credit_packs → users, so packs go between the two.
    async function cleanupAll(emails: string[]) {
      for (const email of emails) {
        const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
        if (user) await supabase.from("bookings").delete().eq("user_id", user.id);
      }
      for (const email of emails) {
        const { data: user } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
        if (!user) continue;
        await supabase.from("credit_packs").delete().eq("user_id", user.id);
        await supabase.from("users").delete().eq("id", user.id);
      }
    }

    it("returns confirmed bookings in [now, until) with their PaymentIntent and pack, timestamps normalized", async () => {
      const ana    = baseRecord().email;
      const bea    = baseRecord().email;
      const anaId  = await seedUser(ana);
      await seedUser(bea);
      const packPi = `pi_test_audit_${Date.now()}_${recordSeq++}`;
      const packId = await seedPack(anaId, packPi);

      // Far-future slots (uniqueFutureSlot), in ascending order.
      const paid      = { ...baseRecord(), email: ana, stripePaymentId: `pi_test_audit_${Date.now()}_${recordSeq++}` };
      const ownPack   = { ...baseRecord(), email: ana, sessionType: "pack" as const, creditPackId: packId };
      const otherPack = { ...baseRecord(), email: bea, sessionType: "pack" as const, creditPackId: packId };
      const free      = { ...baseRecord(), email: bea, sessionType: "free15min" as const };
      const cancelled = { ...baseRecord(), email: ana };
      const completed = { ...baseRecord(), email: ana };
      const noShow    = { ...baseRecord(), email: ana };
      const beyond    = { ...baseRecord(), email: ana }; // starts exactly at `until`: excluded
      // A past confirmed class, on a random day 1–11 years ago (away from other rows).
      const pastStart = Date.now() - (366 + Math.floor(Math.random() * 3650)) * DAY_MS;
      const past = {
        ...baseRecord(), email: ana,
        startsAt: new Date(pastStart).toISOString(),
        endsAt:   new Date(pastStart + 3_600_000).toISOString(),
      };
      // Free calls are 15 minutes; the slot helper hands out 1h windows.
      free.endsAt = new Date(new Date(free.startsAt).getTime() + 15 * 60_000).toISOString();

      try {
        for (const r of [paid, ownPack, otherPack, free, completed, noShow, beyond, past]) await repo.createBooking(r);
        const { cancelToken } = await repo.createBooking(cancelled);
        await repo.consumeCancelToken(cancelToken);
        await repo.markCompleted(await bookingId(completed.eventId));
        await repo.markNoShow(await bookingId(noShow.eventId));

        const rows = await repo.listUpcomingForPaymentAudit(beyond.startsAt);
        // The test DB is shared: keep only this test's students.
        const mine = rows.filter(r => r.email === ana || r.email === bea);

        expect(mine).toEqual([
          {
            bookingId:       await bookingId(paid.eventId),
            email:           ana,
            sessionType:     "session1h",
            startsAt:        paid.startsAt,
            endsAt:          paid.endsAt,
            stripePaymentId: paid.stripePaymentId,
            creditPack:      null,
          },
          {
            bookingId:       await bookingId(ownPack.eventId),
            email:           ana,
            sessionType:     "pack",
            startsAt:        ownPack.startsAt,
            endsAt:          ownPack.endsAt,
            stripePaymentId: null,
            creditPack:      { id: packId, ownedByBookingUser: true, stripePaymentId: packPi },
          },
          {
            bookingId:       await bookingId(otherPack.eventId),
            email:           bea,
            sessionType:     "pack",
            startsAt:        otherPack.startsAt,
            endsAt:          otherPack.endsAt,
            stripePaymentId: null,
            creditPack:      { id: packId, ownedByBookingUser: false, stripePaymentId: packPi },
          },
          {
            bookingId:       await bookingId(free.eventId),
            email:           bea,
            sessionType:     "free15min",
            startsAt:        free.startsAt,
            endsAt:          free.endsAt,
            stripePaymentId: null,
            creditPack:      null,
          },
        ]);
        // Normalized like JS toISOString ("…Z" with milliseconds), not PostgREST's "+00:00".
        for (const r of mine) {
          expect(r.startsAt).toBe(new Date(r.startsAt).toISOString());
          expect(r.endsAt).toBe(new Date(r.endsAt).toISOString());
        }

        // A later horizon lets the class at `until` in; the past one never comes back.
        const wider = (await repo.listUpcomingForPaymentAudit(
          new Date(new Date(beyond.startsAt).getTime() + 1).toISOString(),
        )).filter(r => r.email === ana || r.email === bea);
        expect(wider.map(r => r.startsAt)).toEqual(
          [paid, ownPack, otherPack, free, beyond].map(r => r.startsAt),
        );
      } finally {
        await cleanupAll([ana, bea]);
      }
    });

    it("an empty window returns []", async () => {
      // Nothing can start in the past, so a horizon of "now" is always empty.
      expect(await repo.listUpcomingForPaymentAudit(new Date().toISOString())).toEqual([]);
    });
  });

  it("acquireSlotLock returns true then false for same slot", async () => {
    const startIso = new Date(Date.now() + 999_999_000).toISOString();
    const first  = await repo.acquireSlotLock(startIso, 60);
    const second = await repo.acquireSlotLock(startIso, 60);

    expect(first).toBe(true);
    expect(second).toBe(false);

    await repo.releaseSlotLock(startIso);
    // After release, a new acquire should succeed
    const third = await repo.acquireSlotLock(startIso, 60);
    expect(third).toBe(true);
    await repo.releaseSlotLock(startIso);
  });
});
