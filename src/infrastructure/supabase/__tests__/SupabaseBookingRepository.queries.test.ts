// REFACTOR-R5-P3-02: listByUser and findByCancelToken read the pack size through the
// embedded `credit_packs(pack_size)` — two queries whatever the number of bookings, no
// per-row credit_packs lookup.
//
// Unit test, not DB-gated: the Supabase client is mocked with a chainable builder per
// table that records every from() and resolves to that table's canned result.
import crypto from "crypto";
import type { SupabaseBookingRepository as Repo } from "../SupabaseBookingRepository";

let mockTables: Record<string, { data: unknown; error: unknown }> = {};
const mockFromCalls: string[] = [];

jest.mock("../client", () => {
  const builderFor = (table: string): unknown => {
    const builder: unknown = new Proxy({}, {
      get: (_target, prop) =>
        prop === "then"
          ? (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve(mockTables[table] ?? { data: null, error: null }).then(resolve, reject)
          : () => builder,
    });
    return builder;
  };
  return {
    supabase: {
      from: (table: string) => {
        mockFromCalls.push(table);
        return builderFor(table);
      },
    },
  };
});

// The repository reads CANCEL_SECRET at import: set it first, then import.
const SECRET = "test-cancel-secret";
let bookings: Repo;
beforeAll(async () => {
  process.env.CANCEL_SECRET = SECRET;
  const { SupabaseBookingRepository } = await import("../SupabaseBookingRepository");
  bookings = new SupabaseBookingRepository();
});

beforeEach(() => {
  mockFromCalls.length = 0;
  mockTables = {};
});

const EMAIL = "student@example.com";

const row = (n: number, packSize: number | null) => ({
  calendar_event_id: `evt-${n}`,
  session_type:      packSize ? "pack" : "session1h",
  starts_at:         `2030-01-0${n}T10:00:00+00:00`,
  ends_at:           `2030-01-0${n}T11:00:00+00:00`,
  cancel_token:      `c${n}`,
  join_token:        `j${n}`,
  credit_pack_id:    packSize ? `pack-${packSize}` : null,
  credit_packs:      packSize ? { pack_size: packSize } : null,
});

describe("REFACTOR-R5-P3-02: pack size by join", () => {
  it("listByUser makes 2 queries for three bookings and keeps each packSize", async () => {
    mockTables = {
      users:    { data: { id: "user-1" }, error: null },
      bookings: { data: [row(1, 5), row(2, 10), row(3, null)], error: null },
    };

    const list = await bookings.listByUser(EMAIL);

    expect(mockFromCalls).toEqual(["users", "bookings"]);
    expect(list.map(b => b.record.packSize)).toEqual([5, 10, undefined]);
  });

  it.each([
    ["a pack booking", 5,    5],
    ["a non-pack one", null, undefined],
  ])("findByCancelToken makes 2 queries for %s", async (_label, packSize, expected) => {
    const booking = { ...row(1, packSize), id: "b-1", stripe_payment_id: null, user_id: "user-1" };
    const startsAt = new Date(booking.starts_at).toISOString();
    const token = crypto.createHmac("sha256", SECRET)
      .update(`${booking.calendar_event_id}:${EMAIL}:${startsAt}`).digest("hex");
    mockTables = {
      bookings: { data: booking, error: null },
      users:    { data: { email: EMAIL, name: "Ana" }, error: null },
    };

    const found = await bookings.findByCancelToken(token);

    expect(mockFromCalls).toEqual(["bookings", "users"]);
    expect(found).toMatchObject({ eventId: "evt-1", email: EMAIL, startsAt });
    expect(found!.packSize).toBe(expected);
  });
});
