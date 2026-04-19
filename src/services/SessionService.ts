// ARCH-15: Application service for Zoom session lifecycle and in-session chat.
// Routes that deal with Zoom tokens, session termination, and chat should call
// methods here instead of touching Redis or lib/zoom.ts directly.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IZoomClient } from "@/infrastructure/zoom";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import { log } from "@/lib/logger";

export interface IssueJoinTokenResult {
  token:             string;
  sessionName:       string;
  passcode:          string;
  startIso:          string;
  durationWithGrace: number;
  expiresAt:         number;
}

export class SessionService {
  constructor(
    private readonly sessions:    ISessionRepository,
    private readonly zoom:        IZoomClient,
    private readonly tutorEmail:  string,
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

    const role: 0 | 1 = isTutor ? 1 : 0;
    const token = this.zoom.generateJWT({
      sessionName:     record.sessionName,
      role,
      userName:        params.userName,
      sessionPasscode: record.sessionPasscode,
    });

    log("info", "Zoom token issued", {
      service: "SessionService",
      email:   params.userEmail,
      eventId: params.eventId,
      role,
    });

    return {
      token,
      sessionName:       record.sessionName,
      passcode:          record.sessionPasscode,
      startIso:          record.startIso,
      durationWithGrace: this.zoom.getDurationWithGrace(record.sessionType),
      expiresAt:         Math.floor(Date.now() / 1000) + 3600,
    };
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

    const currentLen = await this.sessions.countChatMessages(params.eventId);
    const message = {
      id:          `${params.eventId}:${currentLen}`,
      senderEmail: params.senderEmail,
      senderName:  params.senderName,
      text:        params.text.trim().slice(0, 1000),
      sentAt:      new Date().toISOString(),
    };
    await this.sessions.appendChatMessage(params.eventId, JSON.stringify(message));
    return { messageId: message.id };
  }

  // Returns chat messages starting at fromIndex.
  // No membership check — mirrors the current SSE handler behaviour.
  async getChatMessages(params: {
    eventId:   string;
    userEmail: string;
    fromIndex: number;
  }): Promise<{ messages: string[]; nextCursor: number }> {
    const total = await this.sessions.countChatMessages(params.eventId);
    if (total <= params.fromIndex) {
      return { messages: [], nextCursor: params.fromIndex };
    }
    const messages = await this.sessions.listChatMessages(params.eventId, params.fromIndex, total - 1);
    return { messages, nextCursor: total };
  }
}
