// DB-02: Supabase-backed implementation of ISessionRepository.
// Sessions are linked to bookings via calendar_event_id (the Google Calendar ID).
// Chat messages persist in session_messages; ordered by sequential id.
// Uses separate queries instead of PostgREST embedded joins for reliability.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ZoomSession, SessionType } from "@/domain/types";
import { supabase } from "./client";

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
      .select("session_id, session_name, session_passcode, duration_minutes")
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
      sessionId:       zs.session_id,
      sessionName:     zs.session_name,
      sessionPasscode: zs.session_passcode,
      studentEmail:    user.email,
      startIso:        booking.starts_at,
      durationMinutes: zs.duration_minutes,
      sessionType:     booking.session_type as SessionType,
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

  async appendChatMessage(eventId: string, message: string): Promise<number> {
    const zoomSessionId = await this.findZoomSessionId(eventId);
    if (!zoomSessionId) throw new Error(`No zoom session for eventId: ${eventId}`);

    const { error } = await supabase.from("session_messages").insert({
      zoom_session_id: zoomSessionId,
      content:         message,
    });

    if (error) throw error;

    return this.countChatMessages(eventId);
  }

  async listChatMessages(
    eventId: string,
    from: number,
    to: number,
  ): Promise<string[]> {
    const zoomSessionId = await this.findZoomSessionId(eventId);
    if (!zoomSessionId) return [];

    const { data, error } = await supabase
      .from("session_messages")
      .select("content")
      .eq("zoom_session_id", zoomSessionId)
      .order("id", { ascending: true })
      .range(from, to);

    if (error) throw error;

    return (data ?? []).map(r => r.content);
  }

  async countChatMessages(eventId: string): Promise<number> {
    const zoomSessionId = await this.findZoomSessionId(eventId);
    if (!zoomSessionId) return 0;

    const { count, error } = await supabase
      .from("session_messages")
      .select("id", { count: "exact", head: true })
      .eq("zoom_session_id", zoomSessionId);

    if (error) throw error;
    return count ?? 0;
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
