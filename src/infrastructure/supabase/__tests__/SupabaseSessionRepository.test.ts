// DB-02: Integration tests for SupabaseSessionRepository.
// Gated on NEXT_PUBLIC_SUPABASE_URL — skips in CI without a database configured.
import { SupabaseSessionRepository } from "../SupabaseSessionRepository";
import { SupabaseBookingRepository } from "../SupabaseBookingRepository";
import { supabase } from "../client";
import { uniqueFutureSlot, purgeTestUsers } from "./slot-helpers";

const describeDb = process.env.NEXT_PUBLIC_SUPABASE_URL ? describe : describe.skip;

const TEST_EMAIL_PATTERN = "test-session-%@example.com";

describeDb("SupabaseSessionRepository", () => {
  const sessionRepo = new SupabaseSessionRepository();
  const bookingRepo = new SupabaseBookingRepository();

  const testEmail = `test-session-${Date.now()}@example.com`;
  const eventId   = `evt-sess-${Date.now()}`;

  const { startIso, endIso } = uniqueFutureSlot();
  const bookingRecord = {
    eventId,
    email:       testEmail,
    name:        "Session Student",
    sessionType: "session1h" as const,
    startsAt:    startIso,
    endsAt:      endIso,
  };

  const zoomSession = {
    sessionId:        "zoom-sess-id-test",
    sessionName:      "Test Session",
    sessionPasscode:  "pass123",
    studentEmail:     testEmail,
    startIso:         bookingRecord.startsAt,
    durationMinutes:  60,
    sessionType:      "session1h" as const,
  };

  beforeAll(async () => {
    // Clear any rows left by a prior failed run before seeding, so the
    // bookings_no_overlap exclusion constraint can't be tripped by stale data.
    await purgeTestUsers(TEST_EMAIL_PATTERN);
    await bookingRepo.createBooking(bookingRecord);
  });

  afterAll(async () => {
    const { data: user } = await supabase
      .from("users").select("id").eq("email", testEmail).maybeSingle();
    if (user) {
      const { data: bookings } = await supabase
        .from("bookings").select("id").eq("user_id", user.id);
      for (const b of bookings ?? []) {
        const { data: zs } = await supabase
          .from("zoom_sessions").select("id").eq("booking_id", b.id);
        for (const z of zs ?? []) {
          await supabase.from("session_messages").delete().eq("zoom_session_id", z.id);
          await supabase.from("zoom_sessions").delete().eq("id", z.id);
        }
      }
      await supabase.from("bookings").delete().eq("user_id", user.id);
      await supabase.from("users").delete().eq("id", user.id);
    }
  });

  it("createSession + findByEventId round-trip", async () => {
    await sessionRepo.createSession(eventId, zoomSession);

    const found = await sessionRepo.findByEventId(eventId);
    expect(found).not.toBeNull();
    expect(found!.sessionId).toBe(zoomSession.sessionId);
    expect(found!.sessionName).toBe(zoomSession.sessionName);
    expect(found!.sessionPasscode).toBe(zoomSession.sessionPasscode);
    expect(found!.durationMinutes).toBe(60);
    expect(found!.studentEmail).toBe(testEmail);
  });

  it("findByEventId returns null for unknown event", async () => {
    const result = await sessionRepo.findByEventId("no-such-event");
    expect(result).toBeNull();
  });

  it("appendChatMessage + countChatMessages", async () => {
    await sessionRepo.appendChatMessage(eventId, "Hello world");
    await sessionRepo.appendChatMessage(eventId, "Second message");

    const count = await sessionRepo.countChatMessages(eventId);
    expect(count).toBe(2);
  });

  it("listChatMessages returns messages in order with range", async () => {
    const messages = await sessionRepo.listChatMessages(eventId, 0, 1);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe("Hello world");
    expect(messages[1]).toBe("Second message");
  });

  it("deleteByEventId removes the zoom session", async () => {
    await sessionRepo.deleteByEventId(eventId);

    const found = await sessionRepo.findByEventId(eventId);
    expect(found).toBeNull();
  });
});
