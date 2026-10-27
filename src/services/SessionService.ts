// ARCH-15: Application service for Zoom session lifecycle and in-session chat.
// Routes that deal with Zoom tokens, session termination, and chat should call
// methods here instead of touching Redis or lib/zoom.ts directly.
// REFACTOR-P2-05: JWT lifetime now derived from session end time + 30-min buffer,
// capped at 4 h by generateZoomJWT. expiresAt aligns with JWT exp.
// REFACTOR-P3-01: postChatMessage broadcasts the new message on a per-eventId
// Realtime channel after persistence so subscribed browsers receive it without
// polling. The broadcast is best-effort: failures are logged but never bubble.
// REFACTOR-P3-04: getChatMessages now enforces the same participant membership
// check as postChatMessage/issueJoinToken — eventId is not a capability.
// SESSION-JOIN-01: issueJoinToken refuses a student before the classroom opens
// (start − booking_settings.join_open_minutes_before; the tutor is exempt), records
// the tutor's first join, and tells the student's client when it may raise the
// tutor-absent alert. reportTutorAbsent re-checks everything server-side and
// emails the admin at most once per session.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend/IEmailClient";
import type { ScheduleConfig, SessionType } from "@/domain/types";
import { BookingNotFoundError, ClassroomNotOpenError, UnauthorizedError } from "@/domain/errors";
import {
  DEFAULT_TUTOR_ABSENT_ALERT_MINUTES,
  joinOpensAtMs,
  tutorAbsentAlertAtMs,
} from "@/lib/booking-config";
import { log } from "@/lib/logger";

/** SESSION-JOIN-01: the slice of ScheduleService this service reads. */
export interface IScheduleConfigSource {
  getConfig(): Promise<ScheduleConfig>;
}

// Admin-facing (Spanish) labels for the tutor-absent alert email.
const SESSION_LABELS: Record<SessionType, string> = {
  free15min: "Encuentro inicial gratuito · 15 min",
  session1h: "Sesión individual · 1 hora",
  session2h: "Sesión individual · 2 horas",
  pack:      "Clase de pack",
};

export interface IssueJoinTokenResult {
  token:             string;
  sessionName:       string;
  passcode:          string;
  startIso:          string;
  durationWithGrace: number;
  expiresAt:         number;
  /**
   * SESSION-JOIN-01: when the student's client may report the tutor absent
   * (ISO, start + tutorAbsentAlertMinutes). Null for the tutor.
   */
  tutorAbsentAlertAt: string | null;
}

export type TutorAbsentOutcome =
  | "sent"
  | "too_early"
  | "session_over"
  | "tutor_joined"
  | "already_sent";

export class SessionService {
  constructor(
    private readonly sessions:    ISessionRepository,
    private readonly zoom:        IZoomClient,
    private readonly tutorEmail:  string,
    private readonly schedule:    IScheduleConfigSource,
    private readonly email:       IEmailClient,
  ) {}

  // Issues a short-lived JWT for a user to join a Zoom session.
  // Enforces membership: only the tutor or the assigned student can join.
  async issueJoinToken(params: {
    eventId:   string;
    userEmail: string;
    userName:  string;
  }): Promise<IssueJoinTokenResult> {
    const record = await this.sessions.findByEventId(params.eventId);
    if (!record) throw new BookingNotFoundError();

    const isTutor   = params.userEmail === this.tutorEmail;
    const isStudent = record.studentEmail
      ? record.studentEmail.toLowerCase() === params.userEmail.toLowerCase()
      : false;

    if (!record.studentEmail) {
      // Legacy record (pre SEC-03) — tutor only
      if (!isTutor) throw new UnauthorizedError();
    } else if (!isTutor && !isStudent) {
      log("warn", "Unauthorized Zoom token request", {
        service:   "SessionService",
        requester: params.userEmail,
        eventId:   params.eventId,
      });
      throw new UnauthorizedError();
    }

    // SESSION-JOIN-01: the classroom opens N minutes before the start for the
    // student. Checked before markStudentJoined so an early attempt doesn't
    // count as attendance. The tutor may enter any time.
    let alertAt: string | null = null;
    if (!isTutor) {
      const config = await this.schedule.getConfig();
      if (Date.now() < joinOpensAtMs(record.startIso, config)) {
        log("info", "Zoom token refused: classroom not open yet", {
          service: "SessionService",
          email:   params.userEmail,
          eventId: params.eventId,
        });
        throw new ClassroomNotOpenError();
      }
      alertAt = new Date(tutorAbsentAlertAtMs(record.startIso, config)).toISOString();
    }

    // REFACTOR-P2-05: compute lifetime from session end + 30-min buffer so the
    // JWT covers the full class. generateZoomJWT caps at 4 h and floors at 10 min.
    const sessionEndMs = new Date(record.startIso).getTime()
      + this.zoom.getDurationWithGrace(record.sessionType) * 60_000;
    const secondsUntilEnd = Math.ceil((sessionEndMs - Date.now()) / 1000);
    const durationSeconds = Math.max(600, secondsUntilEnd + 1800);  // +30 min buffer

    const role: 0 | 1 = isTutor ? 1 : 0;
    const token = this.zoom.generateJWT({
      sessionName:     record.sessionName,
      role,
      userName:        params.userName,
      sessionPasscode: record.sessionPasscode,
      durationSeconds,
    });

    log("info", "Zoom token issued", {
      service:     "SessionService",
      email:       params.userEmail,
      eventId:     params.eventId,
      role,
      lifetimeSec: durationSeconds,
    });

    // Persist first student-join timestamp so the session-cleanup cron can
    // distinguish completed sessions from no-shows. Best-effort: failing here
    // must not block the student from joining. First-join-only is enforced in
    // SQL via an IS NULL guard, so retries are safe.
    if (!isTutor) {
      try {
        await this.sessions.markStudentJoined(params.eventId);
      } catch (err) {
        log("warn", "Could not record student_joined_at", {
          service: "SessionService",
          eventId: params.eventId,
          error:   String(err),
        });
      }
    } else {
      // SESSION-JOIN-01: lets reportTutorAbsent tell "tutor never came" apart.
      try {
        await this.sessions.markTutorJoined(params.eventId);
      } catch (err) {
        log("warn", "Could not record tutor_joined_at", {
          service: "SessionService",
          eventId: params.eventId,
          error:   String(err),
        });
      }
    }

    return {
      token,
      sessionName:       record.sessionName,
      passcode:          record.sessionPasscode,
      startIso:          record.startIso,
      durationWithGrace: this.zoom.getDurationWithGrace(record.sessionType),
      expiresAt:         Math.floor(Date.now() / 1000) + durationSeconds,
      tutorAbsentAlertAt: alertAt,
    };
  }

  // SESSION-JOIN-01: the waiting student's client reports that the tutor hasn't
  // connected. The client only decides WHEN to ask; every condition is re-checked
  // here, and the atomic claim makes the email go out at most once per session.
  async reportTutorAbsent(params: {
    eventId:   string;
    userEmail: string;
  }): Promise<TutorAbsentOutcome> {
    const record = await this.sessions.findByEventId(params.eventId);
    if (!record) throw new BookingNotFoundError();

    const isStudent = record.studentEmail
      ? record.studentEmail.toLowerCase() === params.userEmail.toLowerCase()
      : false;
    if (!isStudent) throw new UnauthorizedError();

    const config = await this.schedule.getConfig();
    const now    = Date.now();
    if (now < tutorAbsentAlertAtMs(record.startIso, config)) return "too_early";

    const endMs = new Date(record.startIso).getTime()
      + this.zoom.getDurationWithGrace(record.sessionType) * 60_000;
    if (now > endMs) return "session_over";

    if (record.tutorJoinedAt) return "tutor_joined";

    if (!(await this.sessions.claimTutorAbsentAlert(params.eventId))) return "already_sent";

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    try {
      await this.email.sendTutorAbsentNotification({
        studentEmail: record.studentEmail,
        studentName:  record.studentName || record.studentEmail,
        sessionLabel: SESSION_LABELS[record.sessionType] ?? record.sessionType,
        startIso:     record.startIso,
        minutesLate:  config.tutorAbsentAlertMinutes ?? DEFAULT_TUTOR_ABSENT_ALERT_MINUTES,
        joinUrl:      record.joinToken ? `${baseUrl}/sesion/${record.joinToken}` : null,
      });
    } catch (err) {
      // The claim stays: a retrying client must not turn into an email storm.
      log("error", "Tutor-absent alert email failed", {
        service: "SessionService",
        eventId: params.eventId,
        error:   String(err),
      });
    }

    log("warn", "Tutor-absent alert raised", {
      service: "SessionService",
      eventId: params.eventId,
      email:   params.userEmail,
    });
    return "sent";
  }

  // Removes the session record so no new JWTs can be issued.
  // Idempotent — safe to call if the session is already gone.
  async terminateSession(eventId: string): Promise<void> {
    await this.sessions.deleteByEventId(eventId);
  }

  // Appends a chat message. Validates that the sender is a session participant.
  async postChatMessage(params: {
    eventId:     string;
    senderEmail: string;
    senderName:  string;
    text:        string;
  }): Promise<{ messageId: string }> {
    const record = await this.sessions.findByEventId(params.eventId);
    if (!record) throw new BookingNotFoundError();

    const isTutor   = params.senderEmail === this.tutorEmail;
    const isStudent = record.studentEmail
      ? record.studentEmail.toLowerCase() === params.senderEmail.toLowerCase()
      : false;
    if (!isTutor && !isStudent) throw new UnauthorizedError();

    // REFACTOR-P3-02: resolve the zoom_session_id once, then reuse it for the
    // count + append below — no more re-resolving eventId inside each call.
    const zoomSessionId = await this.sessions.resolveZoomSessionId(params.eventId);
    if (!zoomSessionId) throw new BookingNotFoundError();

    const currentLen = await this.sessions.countChatMessagesById(zoomSessionId);
    const message = {
      id:          `${params.eventId}:${currentLen}`,
      senderEmail: params.senderEmail,
      senderName:  params.senderName,
      text:        params.text.trim().slice(0, 1000),
      sentAt:      new Date().toISOString(),
    };
    await this.sessions.appendChatMessageById(zoomSessionId, JSON.stringify(message));

    // REFACTOR-P3-01: best-effort live delivery. Persistence above is the
    // source of truth; subscribers that miss the broadcast catch up on
    // reconnect via /api/chat-session/channel.
    try {
      await this.sessions.broadcastChatMessage(params.eventId, message);
    } catch (err) {
      log("warn", "Realtime broadcast failed (subscribers will catch up on next reconnect)", {
        service: "SessionService",
        eventId: params.eventId,
        error:   String(err),
      });
    }

    return { messageId: message.id };
  }

  // Returns chat messages starting at fromIndex. Validates that the caller is a
  // session participant before disclosing any messages.
  async getChatMessages(params: {
    eventId:   string;
    userEmail: string;
    fromIndex: number;
  }): Promise<{ messages: string[]; nextCursor: number }> {
    // REFACTOR-P3-04: Membership check. Previously absent — any authenticated
    // user with knowledge of an eventId could read another session's chat.
    const record = await this.sessions.findByEventId(params.eventId);
    if (!record) throw new BookingNotFoundError();

    const isTutor   = params.userEmail === this.tutorEmail;
    const isStudent = record.studentEmail
      ? record.studentEmail.toLowerCase() === params.userEmail.toLowerCase()
      : false;

    if (!record.studentEmail) {
      // Legacy record (pre SEC-03) — tutor only
      if (!isTutor) throw new UnauthorizedError();
    } else if (!isTutor && !isStudent) {
      log("warn", "Unauthorized chat read attempt", {
        service:   "SessionService",
        requester: params.userEmail,
        eventId:   params.eventId,
      });
      throw new UnauthorizedError();
    }

    // REFACTOR-P3-02: resolve once; the count + list below reuse the id.
    const zoomSessionId = await this.sessions.resolveZoomSessionId(params.eventId);
    if (!zoomSessionId) return { messages: [], nextCursor: params.fromIndex };

    const total = await this.sessions.countChatMessagesById(zoomSessionId);
    if (total <= params.fromIndex) {
      return { messages: [], nextCursor: params.fromIndex };
    }
    const messages = await this.sessions.listChatMessagesById(zoomSessionId, params.fromIndex, total - 1);
    return { messages, nextCursor: total };
  }
}
