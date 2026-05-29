// DB-02: Supabase-backed implementation of ISessionRepository.
// Sessions are linked to bookings via calendar_event_id (the Google Calendar ID).
// Chat messages persist in session_messages; ordered by sequential id.
// Most lookups use separate queries instead of PostgREST embedded joins for
// reliability; the exception is resolveZoomSessionId (see REFACTOR-P3-02).
//
// REFACTOR-P3-01: broadcastChatMessage publishes to a per-eventId Realtime
// channel for sub-second fan-out to subscribed browsers. Best-effort — the
// persisted row in session_messages remains the source of truth.
//
// REFACTOR-P3-02: chat reads/writes used to re-resolve eventId → booking_id →
// zoom_session_id (2 queries) inside every method. resolveZoomSessionId now
// collapses that to a single embedded-join round trip; SessionService calls it
// once per request and threads the id into the *ById methods. The eventId-based
// chat methods remain as thin wrappers over resolve + *ById.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ZoomSession, SessionType } from "@/domain/types";
import { supabase } from "./client";
import { chatChannelName } from "@/lib/realtime-channel";

export class SupabaseSessionRepository implements ISessionRepository {
  async createSession(eventId: string, session: ZoomSession): Promise<void> {
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id")
      .eq("calendar_event_id", eventId)
      .maybeSingle();

    if (bookingErr) throw bookingErr;
    if (!booking) throw new Error(`No booking found for eventId: ${eventId}`);

    const { error } = await supabase.from("zoom_sessions").insert({
      booking_id:       booking.id,
      session_id:       session.sessionId,
      session_name:     session.sessionName,
      session_passcode: session.sessionPasscode,
      duration_minutes: session.durationMinutes,
    });

    if (error) throw error;
  }

  async findByEventId(eventId: string): Promise<ZoomSession | null> {
    // Step 1: find booking by calendar_event_id — only confirmed bookings are joinable
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, session_type, starts_at, user_id")
      .eq("calendar_event_id", eventId)
      .eq("status", "confirmed")
      .maybeSingle();

    if (bookingErr || !booking) return null;

    // Step 2: find zoom session linked to that booking
    const { data: zs, error: zsErr } = await supabase
      .from("zoom_sessions")
      .select("session_id, session_name, session_passcode, duration_minutes, student_joined_at")
      .eq("booking_id", booking.id)
      .maybeSingle();

    if (zsErr || !zs) return null;

    // Step 3: get student email
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("email")
      .eq("id", booking.user_id)
      .single();

    if (userErr || !user) return null;

    return {
      sessionId:        zs.session_id,
      sessionName:      zs.session_name,
      sessionPasscode:  zs.session_passcode,
      studentEmail:     user.email,
      startIso:         booking.starts_at,
      durationMinutes:  zs.duration_minutes,
      sessionType:      booking.session_type as SessionType,
      studentJoinedAt:  zs.student_joined_at ?? null,
    };
  }

  async deleteByEventId(eventId: string): Promise<void> {
    const zoomSessionId = await this.findZoomSessionId(eventId);
    if (!zoomSessionId) return;

    const { error } = await supabase
      .from("zoom_sessions")
      .delete()
      .eq("id", zoomSessionId);

    if (error) throw error;
  }

  async markStudentJoined(eventId: string): Promise<void> {
    const zoomSessionId = await this.findZoomSessionId(eventId);
    if (!zoomSessionId) return;

    // First-join-only: the IS NULL guard makes this a no-op on subsequent
    // joins so we preserve the original timestamp.
    const { error } = await supabase
      .from("zoom_sessions")
      .update({ student_joined_at: new Date().toISOString() })
      .eq("id", zoomSessionId)
      .is("student_joined_at", null);

    if (error) throw error;
  }

  // REFACTOR-P3-02: Resolves eventId → zoom_session_id in a single round trip
  // via a PostgREST embedded join (FK chain zoom_sessions.booking_id → bookings.id).
  // Callers should call this once per request, then pass the id into the *ById
  // methods rather than re-resolving inside each one.
  async resolveZoomSessionId(eventId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from("bookings")
      .select("zoom_sessions!inner(id)")
      .eq("calendar_event_id", eventId)
      .maybeSingle();

    if (error) throw error;
    const joined = data?.zoom_sessions as { id: string } | { id: string }[] | null | undefined;
    if (!joined) return null;
    // PostgREST returns either a single object or an array depending on the FK direction.
    return Array.isArray(joined) ? joined[0]?.id ?? null : joined.id;
  }

  async appendChatMessageById(zoomSessionId: string, message: string): Promise<number> {
    const { error } = await supabase.from("session_messages").insert({
      zoom_session_id: zoomSessionId,
      content:         message,
    });

    if (error) throw error;

    return this.countChatMessagesById(zoomSessionId);
  }

  async listChatMessagesById(
    zoomSessionId: string,
    from: number,
    to: number,
  ): Promise<string[]> {
    const { data, error } = await supabase
      .from("session_messages")
      .select("content")
      .eq("zoom_session_id", zoomSessionId)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    return (data ?? []).map(r => r.content);
  }

  async countChatMessagesById(zoomSessionId: string): Promise<number> {
    const { count, error } = await supabase
      .from("session_messages")
      .select("id", { count: "exact", head: true })
      .eq("zoom_session_id", zoomSessionId);

    if (error) throw error;
    return count ?? 0;
  }

  // REFACTOR-P3-02: eventId-based methods kept as thin wrappers so convenience
  // callers (admin tools, scripts, integration tests) keep working. They resolve
  // the zoom_session_id once, then delegate to the *ById variant.
  async appendChatMessage(eventId: string, message: string): Promise<number> {
    const zoomSessionId = await this.resolveZoomSessionId(eventId);
    if (!zoomSessionId) throw new Error(`No zoom session for eventId: ${eventId}`);
    return this.appendChatMessageById(zoomSessionId, message);
  }

  async listChatMessages(
    eventId: string,
    from: number,
    to: number,
  ): Promise<string[]> {
    const zoomSessionId = await this.resolveZoomSessionId(eventId);
    if (!zoomSessionId) return [];
    return this.listChatMessagesById(zoomSessionId, from, to);
  }

  async countChatMessages(eventId: string): Promise<number> {
    const zoomSessionId = await this.resolveZoomSessionId(eventId);
    if (!zoomSessionId) return 0;
    return this.countChatMessagesById(zoomSessionId);
  }

  // REFACTOR-P3-01: per-eventId broadcast. Channel name is HMAC(eventId,
  // REALTIME_CHANNEL_SECRET), unguessable without the secret. Subscribers learn
  // the name from /api/chat-session/channel after a membership check.
  async broadcastChatMessage(eventId: string, message: unknown): Promise<void> {
    const channelName = chatChannelName(eventId);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    });
    try {
      await channel.send({ type: "broadcast", event: "message", payload: message });
    } finally {
      await supabase.removeChannel(channel);
    }
  }

  private async findZoomSessionId(eventId: string): Promise<string | null> {
    const { data: booking } = await supabase
      .from("bookings")
      .select("id")
      .eq("calendar_event_id", eventId)
      .maybeSingle();

    if (!booking) return null;

    const { data: zs } = await supabase
      .from("zoom_sessions")
      .select("id")
      .eq("booking_id", booking.id)
      .maybeSingle();

    return zs?.id ?? null;
  }
}
