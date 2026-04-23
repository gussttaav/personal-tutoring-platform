// DB-02: Supabase-backed implementation of IBookingRepository.
// Token generation replicates the HMAC logic from booking-tokens.ts without
// importing that module (it has Redis side-effects at module scope).
// Separate queries are used instead of PostgREST embedded joins to avoid
// relying on FK-hint syntax that varies across PostgREST versions.
import type { IBookingRepository } from "@/domain/repositories/IBookingRepository";
import type { BookingRecord, SessionType } from "@/domain/types";
import { supabase } from "./client";
import crypto from "crypto";

const CANCEL_SECRET = process.env.CANCEL_SECRET!;

function signToken(payload: string): string {
  return crypto.createHmac("sha256", CANCEL_SECRET).update(payload).digest("hex");
}

const HEX64 = /^[0-9a-f]{64}$/;

export class SupabaseBookingRepository implements IBookingRepository {
  async createBooking(
    record: Omit<BookingRecord, "used">,
  ): Promise<{ cancelToken: string; joinToken: string }> {
    const userId = await this.upsertUser(record.email, record.name);

    const cancelPayload = `${record.eventId}:${record.email}:${record.startsAt}`;
    const joinPayload   = `join:${cancelPayload}`;
    const cancelToken   = signToken(cancelPayload);
    const joinToken     = signToken(joinPayload);

    const { error } = await supabase.from("bookings").insert({
      user_id:           userId,
      session_type:      record.sessionType,
      starts_at:         record.startsAt,
      ends_at:           record.endsAt,
      status:            "confirmed",
      calendar_event_id: record.eventId,
      cancel_token:      cancelToken,
      join_token:        joinToken,
    });

    if (error) throw error;

    return { cancelToken, joinToken };
  }

  async findByCancelToken(token: string): Promise<BookingRecord | null> {
    if (!HEX64.test(token)) return null;

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, calendar_event_id, session_type, starts_at, ends_at, credit_pack_id, user_id")
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

    const packSize = await this.getPackSize(booking.credit_pack_id);

    return {
      eventId,
      email,
      name:        user.name,
      sessionType: booking.session_type as SessionType,
      startsAt,
      endsAt:      booking.ends_at,
      used:        false,
      packSize,
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
    if (!HEX64.test(token)) return false;

    // UPDATE + WHERE status='confirmed' is atomic: PostgreSQL row-locks the
    // matching row, so concurrent calls can't both succeed.
    const { data, error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancel_token: null, join_token: null })
      .eq("cancel_token", token)
      .eq("status", "confirmed")
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  }

  async listByUser(
    email: string,
  ): Promise<{ cancelToken: string; record: BookingRecord }[]> {
    const normalized = email.toLowerCase().trim();

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (!user) return [];

    const { data, error } = await supabase
      .from("bookings")
      .select("calendar_event_id, session_type, starts_at, ends_at, cancel_token, credit_pack_id")
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .order("starts_at", { ascending: true });

    if (error) throw error;

    const results = await Promise.all(
      (data ?? []).map(async row => {
        const packSize = await this.getPackSize(row.credit_pack_id);
        return {
          cancelToken: row.cancel_token as string,
          record: {
            eventId:     (row.calendar_event_id ?? "") as string,
            email:       normalized,
            name:        "",
            sessionType: row.session_type as SessionType,
            startsAt:    row.starts_at as string,
            endsAt:      row.ends_at as string,
            used:        false,
            packSize,
          } as BookingRecord,
        };
      }),
    );

    return results;
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

  private async getPackSize(
    creditPackId: string | null,
  ): Promise<number | undefined> {
    if (!creditPackId) return undefined;
    const { data } = await supabase
      .from("credit_packs")
      .select("pack_size")
      .eq("id", creditPackId)
      .maybeSingle();
    return data?.pack_size ?? undefined;
  }
}
