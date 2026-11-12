// DB-02: Supabase-backed implementation of IBookingRepository.
// Token generation replicates the HMAC logic from booking-tokens.ts without
// importing that module (it has Redis side-effects at module scope).
// Separate queries are used instead of PostgREST embedded joins to avoid
// relying on FK-hint syntax that varies across PostgREST versions (the pack size is the
// exception: one unambiguous FK, no hint — REFACTOR-R5-P3-02).
// BOOKING-HISTORY-01: listHistoryByUser — keyset-paginated past bookings.
// REFACTOR-R4-P1-01: hasActiveFreeSession — the free-call cap (fails closed on error).
// REFACTOR-R4-P1-02: the reads that authorize a side effect fail CLOSED — listByUser and
// hasAnyBooking's user lookups, hasBookingForPayment (now a count: a rescheduled paid
// class leaves two rows per PaymentIntent, which .maybeSingle() errors on) and
// findByStripePaymentId throw on a read error instead of answering "absent".
// REFACTOR-R4-P1-03: reinstateBooking — a reschedule's claim compensation, restoring the
// original row with its original (recomputed) tokens; findByCancelToken also returns
// credit_pack_id and stripe_payment_id so a reschedule can carry them over.
// REFACTOR-R4-P1-04: cancelByToken wraps the cancel_booking RPC (status flip + pack credit
// restore, originating pack first, in one transaction).
// REFACTOR-R4-P3-03: listUpcomingForPaymentAudit — the booking-payment audit's read. Three
// queries (bookings, then their users and packs), and every error throws.
// REFACTOR-R5-P1-03: the one-free-call cap's DB backstop (bookings_one_free_call_per_user,
// migration 0029). createBooking maps its 23505 to FreeSessionAlreadyUsedError;
// reinstateBooking answers false on it, like on the exclusion constraint.
// REFACTOR-R5-P2-02: claimForReschedule marks the reschedule's original `rescheduled`
// (migration 0030), reinstateBooking clears it, and listHistoryByUser reads it along with
// `credit_restored` (written by cancel_booking) — the row says what happened, so deriveAmount
// gives a rescheduled original no amount and the history labels stop guessing.
// REFACTOR-R5-P3-02: findByCancelToken and listByUser embed the pack size through the
// credit_pack_id FK (`credit_packs(pack_size)`, the one bookings → credit_packs FK, so no
// hint is needed) — was one credit_packs query per row, whose error was ignored, so a blip
// read as "no pack". The per-row helper is gone.
import { FreeSessionAlreadyUsedError } from "@/domain/errors";
import type { CancelResult, IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { IReviewRepository } from "@/domain/repositories/IReviewRepository";
import type {
  BookingHistoryEntry,
  BookingHistoryPage,
  BookingRecord,
  BookingStatus,
  PaymentAuditBooking,
  SessionType,
  SingleSessionBookingDetail,
} from "@/domain/types";
import { SupabaseReviewRepository } from "./SupabaseReviewRepository";
import { buildCursor, deriveAmount, parseCursor, type PackInfo, type PaymentInfo } from "./booking-history";
import { supabase } from "./client";
import crypto from "crypto";

const CANCEL_SECRET = process.env.CANCEL_SECRET!;

function signToken(payload: string): string {
  return crypto.createHmac("sha256", CANCEL_SECRET).update(payload).digest("hex");
}

const HEX64 = /^[0-9a-f]{64}$/;

// REFACTOR-R5-P1-03: the DB backstop of the one-free-call cap. Two concurrent requests
// both pass hasActiveFreeSession; the second insert lands here. PostgREST names the index
// in `message` ("duplicate key value violates unique constraint \"…\"").
const FREE_CALL_INDEX = "bookings_one_free_call_per_user";

function isFreeCallViolation(error: { code?: string; message?: string; details?: string }): boolean {
  return error.code === "23505"
    && `${error.message ?? ""} ${error.details ?? ""}`.includes(FREE_CALL_INDEX);
}

// REFACTOR-R5-P3-02: the embedded `credit_packs(pack_size)` of a booking row — an object
// (many-to-one) or null when the booking has no pack.
function embeddedPackSize(pack: { pack_size: number } | null): number | undefined {
  return pack?.pack_size ?? undefined;
}

export class SupabaseBookingRepository implements IBookingRepository {
  // The review lookup lives here because this repository already owns the
  // multi-query fan-out for history; injecting it keeps BookingService's
  // constructor unchanged. Default-constructed so `new SupabaseBookingRepository()`
  // (how the singleton in ./index.ts is built) keeps working.
  constructor(private readonly reviews: IReviewRepository = new SupabaseReviewRepository()) {}

  async createBooking(
    record: Omit<BookingRecord, "used">,
  ): Promise<{ cancelToken: string; joinToken: string }> {
    const userId = await this.upsertUser(record.email, record.name);

    const cancelPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
    const joinPayload   = `join:${cancelPayload}`;
    const cancelToken   = signToken(cancelPayload);
    const joinToken     = signToken(joinPayload);

    const { error } = await supabase.from("bookings").insert({
      user_id:            userId,
      session_type:       record.sessionType,
      starts_at:          record.startsAt,
      ends_at:            record.endsAt,
      status:             "confirmed",
      calendar_event_id:  record.eventId,
      cancel_token:       cancelToken,
      join_token:         joinToken,
      ...(record.stripePaymentId ? { stripe_payment_id: record.stripePaymentId } : {}),
      // BOOKING-PACKLINK-01: link pack bookings to the pack that paid for them.
      ...(record.creditPackId    ? { credit_pack_id:    record.creditPackId    } : {}),
    });

    if (error) {
      if (isFreeCallViolation(error)) throw new FreeSessionAlreadyUsedError();
      throw error;
    }

    return { cancelToken, joinToken };
  }

  async findByCancelToken(token: string): Promise<BookingRecord | null> {
    if (!HEX64.test(token)) return null;

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, calendar_event_id, session_type, starts_at, ends_at, credit_pack_id, stripe_payment_id, user_id, credit_packs(pack_size)")
      .eq("cancel_token", token)
      .eq("status", "confirmed")
      .maybeSingle();

    if (bookingErr || !booking) return null;

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", booking.user_id)
      .single();

    if (userErr || !user) return null;

    const email    = user.email;
    // Normalize: Postgres returns "2026-04-21T10:04:43.13+00:00" but the token
    // was signed with JavaScript's toISOString() format "2026-04-21T10:04:43.130Z".
    const startsAt = new Date(booking.starts_at).toISOString();
    const eventId  = (booking.calendar_event_id ?? "") as string;

    const expected = signToken(`${eventId}:${email}:${startsAt}`);
    const valid = crypto.timingSafeEqual(
      Buffer.from(token,    "hex"),
      Buffer.from(expected, "hex"),
    );
    if (!valid) return null;

    const packSize = embeddedPackSize(booking.credit_packs);

    return {
      eventId,
      email,
      name:        user.name,
      sessionType: booking.session_type as SessionType,
      startsAt,
      endsAt:      booking.ends_at,
      used:        false,
      packSize,
      creditPackId:    booking.credit_pack_id    ?? undefined,
      stripePaymentId: booking.stripe_payment_id ?? undefined,
    };
  }

  async findByJoinToken(
    token: string,
  ): Promise<{ eventId: string; email: string; name: string; sessionType: SessionType; startsAt: string } | null> {
    if (!HEX64.test(token)) return null;

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("calendar_event_id, user_id, session_type, starts_at")
      .eq("join_token", token)
      .eq("status", "confirmed")
      .maybeSingle();

    if (bookingErr || !booking) return null;

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", booking.user_id)
      .single();

    if (userErr || !user) return null;

    return {
      eventId:     (booking.calendar_event_id ?? "") as string,
      email:       user.email,
      name:        user.name,
      sessionType: booking.session_type as SessionType,
      startsAt:    new Date(booking.starts_at).toISOString(),
    };
  }

  async consumeCancelToken(token: string): Promise<boolean> {
    return this.flipToCancelled(token, false);
  }

  // REFACTOR-R5-P2-02: the reschedule claim — the same compare-and-swap, plus the marker.
  async claimForReschedule(token: string): Promise<boolean> {
    return this.flipToCancelled(token, true);
  }

  private async flipToCancelled(token: string, rescheduled: boolean): Promise<boolean> {
    if (!HEX64.test(token)) return false;

    // UPDATE + WHERE status='confirmed' is atomic: PostgreSQL row-locks the
    // matching row, so concurrent calls can't both succeed.
    const { data, error } = await supabase
      .from("bookings")
      .update({
        status: "cancelled", cancel_token: null, join_token: null,
        ...(rescheduled ? { rescheduled: true } : {}),
      })
      .eq("cancel_token", token)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  }

  // REFACTOR-R4-P1-04: one RPC, one transaction — an error means nothing was written.
  async cancelByToken(token: string): Promise<CancelResult> {
    const notConsumed: CancelResult = {
      consumed: false, restored: false, restoredPackId: null, fromOriginating: false, credits: 0,
    };
    if (!HEX64.test(token)) return notConsumed;

    const { data, error } = await supabase.rpc("cancel_booking", { p_cancel_token: token });
    if (error) throw error;

    const result = data as Partial<CancelResult> & { consumed: boolean };
    if (!result.consumed) return notConsumed;
    return {
      consumed:        true,
      restored:        result.restored === true,
      restoredPackId:  result.restoredPackId ?? null,
      fromOriginating: result.fromOriginating === true,
      credits:         result.credits ?? 0,
    };
  }

  // REFACTOR-R4-P1-03: undo a reschedule's claim. The tokens are recomputed exactly as
  // createBooking signed them, so the links in the original confirmation email work again.
  async reinstateBooking(record: BookingRecord): Promise<boolean> {
    const startsAt      = new Date(record.startsAt).toISOString(); // TIMESTAMPTZ gotcha
    const cancelPayload = `${record.eventId}:${record.email}:${startsAt}`;

    const { data, error } = await supabase
      .from("bookings")
      .update({
        status:       "confirmed",
        cancel_token: signToken(cancelPayload),
        join_token:   signToken(`join:${cancelPayload}`),
        rescheduled:  false, // REFACTOR-R5-P2-02
      })
      .eq("calendar_event_id", record.eventId)
      .eq("status", "cancelled")
      .select("id")
      .maybeSingle();

    if (error?.code === "23P01") return false; // exclusion_violation: the slot was re-taken
    // REFACTOR-R5-P1-03: the user booked another free call while this one was claimed.
    if (error && isFreeCallViolation(error)) return false;
    if (error) throw error;
    return data !== null;
  }

  async listByUser(
    email: string,
  ): Promise<{ cancelToken: string; joinToken: string; record: BookingRecord }[]> {
    const normalized = email.toLowerCase().trim();

    // REFACTOR-R4-P1-02: an error here must not read as "no bookings" — the deletion
    // gate takes [] as permission to erase the account.
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("calendar_event_id, session_type, starts_at, ends_at, cancel_token, join_token, credit_pack_id, credit_packs(pack_size)")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("starts_at", { ascending: true });

    if (error) throw error;

    return (data ?? []).map(row => ({
      cancelToken: row.cancel_token as string,
      joinToken:   row.join_token as string,
      record: {
        eventId:     (row.calendar_event_id ?? "") as string,
        email:       normalized,
        name:        "",
        sessionType: row.session_type as SessionType,
        startsAt:    row.starts_at as string,
        endsAt:      row.ends_at as string,
        used:        false,
        packSize:    embeddedPackSize(row.credit_packs),
      } as BookingRecord,
    }));
  }

  async listHistoryByUser(
    email: string,
    opts: { limit: number; cursor?: string },
  ): Promise<BookingHistoryPage> {
    const normalized = email.toLowerCase().trim();
    const keyset     = opts.cursor ? parseCursor(opts.cursor) : null;

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (!user) return { entries: [], nextCursor: null };

    // 1. The page itself. No status filter — a cancelled class is still history.
    //    Fetch one extra row as a has-more probe, then drop it.
    let query = supabase
      .from("bookings")
      .select("id, calendar_event_id, session_type, starts_at, ends_at, status, note, credit_pack_id, stripe_payment_id, credit_restored, rescheduled")
      .eq("user_id", user.id)
      .lt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(opts.limit + 1);

    if (keyset) {
      query = query.or(
        `starts_at.lt."${keyset.startsAt}",and(starts_at.eq."${keyset.startsAt}",id.lt.${keyset.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows       = data ?? [];
    const hasMore    = rows.length > opts.limit;
    const page       = hasMore ? rows.slice(0, opts.limit) : rows;
    if (page.length === 0) return { entries: [], nextCursor: null };

    // 2-4. Bulk-resolve the enrichments. Three bounded `in` queries rather than
    //      a per-row lookup — the ids all come from the page above.
    const bookingIds   = page.map(r => r.id as string);
    const packIds      = [...new Set(page.map(r => r.credit_pack_id).filter((v): v is string => !!v))];
    const singlePayIds = page.map(r => r.stripe_payment_id).filter((v): v is string => !!v);

    const [reviews, packs] = await Promise.all([
      this.reviews.findByBookingIds(bookingIds),
      this.fetchPacks(packIds),
    ]);

    // A pack class was paid for at pack-purchase time, so its charge is on the
    // pack's payment, not the booking's.
    const payIds   = [...new Set([...singlePayIds, ...[...packs.values()].map(p => p.stripePaymentId)])];
    const payments = await this.fetchPayments(payIds, user.id);

    const entries: BookingHistoryEntry[] = page.map(row => {
      const sessionType = row.session_type as SessionType;
      const pack        = row.credit_pack_id ? packs.get(row.credit_pack_id as string) : undefined;

      const { amountCents, currency } = deriveAmount(
        sessionType,
        pack,
        (row.stripe_payment_id ?? null) as string | null,
        payments,
        row.rescheduled === true, // REFACTOR-R5-P2-02
      );

      return {
        id:          row.id as string,
        eventId:     (row.calendar_event_id ?? "") as string,
        sessionType,
        status:      row.status as BookingStatus,
        startsAt:    new Date(row.starts_at as string).toISOString(),
        endsAt:      new Date(row.ends_at   as string).toISOString(),
        ...(pack ? { packSize: pack.packSize } : {}),
        note:        (row.note ?? null) as string | null,
        amountCents,
        currency,
        review:      reviews.get(row.id as string) ?? null,
        // REFACTOR-R5-P2-02: NULL credit_restored = not a pack cancel, or a legacy row.
        creditRestored: (row.credit_restored ?? null) as boolean | null,
        rescheduled:    row.rescheduled === true,
      };
    });

    const last       = page[page.length - 1];
    const nextCursor = hasMore
      ? buildCursor(last.starts_at as string, last.id as string)
      : null;

    return { entries, nextCursor };
  }

  private async fetchPacks(packIds: string[]): Promise<Map<string, PackInfo>> {
    if (packIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from("credit_packs")
      .select("id, pack_size, stripe_payment_id")
      .in("id", packIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map(p => [
        p.id as string,
        { packSize: p.pack_size as number, stripePaymentId: p.stripe_payment_id as string },
      ]),
    );
  }

  private async fetchPayments(
    stripePaymentIds: string[],
    userId: string,
  ): Promise<Map<string, PaymentInfo>> {
    if (stripePaymentIds.length === 0) return new Map();

    // Scoped to the user as defence-in-depth: the ids already came from this
    // user's own bookings and packs, so this can only ever narrow the result.
    const { data, error } = await supabase
      .from("payments")
      .select("stripe_payment_id, amount_cents, currency")
      .eq("user_id", userId)
      .in("stripe_payment_id", stripePaymentIds);

    if (error) throw error;

    return new Map(
      (data ?? []).map(p => [
        p.stripe_payment_id as string,
        { amountCents: p.amount_cents as number, currency: p.currency as string },
      ]),
    );
  }

  async hasAnyBooking(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();

    // REFACTOR-R4-P1-02: throws on a read error, like the bookings count below.
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return false;

    const { count, error } = await supabase
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .limit(1);

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // REFACTOR-R4-P1-01: any non-cancelled free15min row counts. Both reads throw on
  // error: answering "no free call yet" on a failed read would lift the cap.
  async hasActiveFreeSession(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (userErr) throw userErr;
    if (!user) return false;

    const { count, error } = await supabase
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", user.id)
      .eq("session_type", "free15min")
      .neq("status", "cancelled");

    if (error) throw error;
    return (count ?? 0) > 0;
  }

  async findIdByEventIdForUser(
    eventId: string,
    userId: string,
  ): Promise<{ id: string; sessionType: SessionType; status: string } | null> {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, session_type, status")
      .eq("calendar_event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id:          data.id,
      sessionType: data.session_type as SessionType,
      status:      data.status,
    };
  }

  async findByEventId(eventId: string): Promise<{ id: string; status: string } | null> {
    const { data, error } = await supabase
      .from("bookings")
      .select("id, status")
      .eq("calendar_event_id", eventId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return { id: data.id, status: data.status as string };
  }

  // REFACTOR-P4-01: reconciliation lookup — true if a booking row exists for this PaymentIntent.
  // REFACTOR-R4-P1-02: also the webhook's status-agnostic "already fulfilled" gate. A count,
  // not .maybeSingle(): a rescheduled paid class leaves two rows (old cancelled + new
  // confirmed) sharing the PaymentIntent, and .maybeSingle() errors on two rows.
  async hasBookingForPayment(stripePaymentId: string): Promise<boolean> {
    const { count, error } = await supabase
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("stripe_payment_id", stripePaymentId);
    if (error) throw error;
    return (count ?? 0) > 0;
  }

  // SINGLE-SESSION-CONFIRM-01: detail finder for the single-session polling surface.
  // Scoped to status='confirmed' so a cancelled/completed/no_show row never reports a
  // stale `confirmed` (cancellation UPDATEs status in place and nulls the join token).
  async findByStripePaymentId(
    stripePaymentId: string,
  ): Promise<SingleSessionBookingDetail | null> {
    const { data, error } = await supabase
      .from("bookings")
      .select("calendar_event_id, starts_at, ends_at, session_type, join_token")
      .eq("stripe_payment_id", stripePaymentId)
      .eq("status", "confirmed")
      .maybeSingle();

    // REFACTOR-R4-P1-02: an error is not "no confirmed booking" — throw, and keep null
    // for the genuinely absent (or not-yet-joinable) row.
    if (error) throw error;
    if (!data || !data.join_token || !data.calendar_event_id) return null;

    return {
      eventId:     data.calendar_event_id,
      startIso:    new Date(data.starts_at).toISOString(),
      endIso:      new Date(data.ends_at).toISOString(),
      sessionType: data.session_type as SessionType,
      joinToken:   data.join_token,
    };
  }

  // REFACTOR-R4-P3-03: the booking-payment audit's read. Every error throws — a failed
  // read must never come back as an empty (= "all paid") list.
  async listUpcomingForPaymentAudit(untilIso: string): Promise<PaymentAuditBooking[]> {
    const { data: rows, error } = await supabase
      .from("bookings")
      .select("id, user_id, session_type, starts_at, ends_at, stripe_payment_id, credit_pack_id")
      .eq("status", "confirmed")
      .gte("starts_at", new Date().toISOString())
      .lt("starts_at", untilIso)
      .order("starts_at", { ascending: true });

    if (error) throw error;
    if (!rows || rows.length === 0) return [];

    const userIds = [...new Set(rows.map(r => r.user_id))];
    const packIds = [...new Set(rows.map(r => r.credit_pack_id).filter((v): v is string => !!v))];

    const { data: users, error: usersErr } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds);

    if (usersErr) throw usersErr;
    const emails = new Map((users ?? []).map(u => [u.id, u.email]));

    const packs = new Map<string, { userId: string; stripePaymentId: string }>();
    if (packIds.length > 0) {
      const { data, error: packsErr } = await supabase
        .from("credit_packs")
        .select("id, user_id, stripe_payment_id")
        .in("id", packIds);

      if (packsErr) throw packsErr;
      for (const p of data ?? []) {
        packs.set(p.id, { userId: p.user_id, stripePaymentId: p.stripe_payment_id });
      }
    }

    return rows.map(row => {
      const email = emails.get(row.user_id);
      // bookings.user_id is a NOT NULL FK, so this is an inconsistent read, not a state.
      if (email === undefined) throw new Error(`Payment audit: no user row for booking ${row.id}`);
      const pack = row.credit_pack_id ? packs.get(row.credit_pack_id) : undefined;

      return {
        bookingId:       row.id,
        email,
        sessionType:     row.session_type as SessionType,
        startsAt:        new Date(row.starts_at).toISOString(),
        endsAt:          new Date(row.ends_at).toISOString(),
        stripePaymentId: row.stripe_payment_id ?? null,
        creditPack:      pack
          ? {
              id:                 row.credit_pack_id as string,
              ownedByBookingUser: pack.userId === row.user_id,
              stripePaymentId:    pack.stripePaymentId,
            }
          : null,
      };
    });
  }

  async markCompleted(bookingId: string): Promise<void> {
    // Conservative + idempotent: only 'confirmed' → 'completed'. Never
    // overwrites 'cancelled' / 'no_show'; a second call is a no-op.
    const { error } = await supabase
      .from("bookings")
      .update({ status: "completed" })
      .eq("id", bookingId)
      .eq("status", "confirmed");

    if (error) throw error;
  }

  async markNoShow(bookingId: string): Promise<void> {
    // Conservative + idempotent: only 'confirmed' → 'no_show'. Mirrors markCompleted.
    const { error } = await supabase
      .from("bookings")
      .update({ status: "no_show" })
      .eq("id", bookingId)
      .eq("status", "confirmed");

    if (error) throw error;
  }

  async countCompletedPaid(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from("bookings")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId)
      .eq("status", "completed")
      .in("session_type", ["session1h", "session2h", "pack"]);

    if (error) throw error;
    return count ?? 0;
  }

  async recordRescheduleFailure(data: {
    email:       string;
    startIso:    string;
    endIso:      string;
    sessionType: SessionType;
    error:       string;
  }): Promise<void> {
    const userId = await this.upsertUser(data.email, "");

    await supabase.from("audit_log").insert({
      user_id: userId,
      action:  "reschedule_failed",
      details: {
        ts:          new Date().toISOString(),
        startIso:    data.startIso,
        endIso:      data.endIso,
        sessionType: data.sessionType,
        error:       data.error,
      },
    });
  }

  async acquireSlotLock(
    startIso: string,
    durationMinutes: number,
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc("acquire_slot_lock", {
      p_start_iso:        startIso,
      p_duration_minutes: durationMinutes,
    });
    if (error) throw error;
    return data as boolean;
  }

  async releaseSlotLock(startIso: string): Promise<void> {
    const { error } = await supabase
      .from("slot_locks")
      .delete()
      .eq("start_iso", startIso);
    if (error) throw error;
  }

  async recordPendingTermination(eventId: string, fireAtMs: number): Promise<void> {
    const { error } = await supabase.from("pending_terminations").upsert({
      event_id: eventId,
      fire_at:  new Date(fireAtMs).toISOString(),
    }, { onConflict: "event_id" });
    if (error) throw error;
  }

  async deletePendingTermination(eventId: string): Promise<void> {
    const { error } = await supabase
      .from("pending_terminations")
      .delete()
      .eq("event_id", eventId);
    if (error) throw error;
  }

  async listDuePendingTerminations(
    limit: number,
    maxAttempts: number,
  ): Promise<{ eventId: string; attempts: number }[]> {
    const { data, error } = await supabase
      .from("pending_terminations")
      .select("event_id, attempts")
      .lt("fire_at", new Date().toISOString())
      .lt("attempts", maxAttempts)
      .order("fire_at", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(row => ({
      eventId:  row.event_id as string,
      attempts: row.attempts as number,
    }));
  }

  async recordPendingTerminationFailure(
    eventId: string,
    attempts: number,
    error: string,
  ): Promise<void> {
    const { error: dbError } = await supabase
      .from("pending_terminations")
      .update({ attempts, last_error: error })
      .eq("event_id", eventId);
    if (dbError) throw dbError;
  }

  private async upsertUser(email: string, name: string): Promise<string> {
    const normalized = email.toLowerCase().trim();
    const { data, error } = await supabase
      .from("users")
      .upsert({ email: normalized, name }, { onConflict: "email" })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }
}
