// ARCH-15: Unit tests for SessionService.
// SESSION-JOIN-01: the constructor also takes the schedule (join window + alert
// delay) and the email client; `svc()` wires the defaults for the older suites.
import { SessionService, type IScheduleConfigSource } from "../SessionService";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IZoomClient } from "@/infrastructure/zoom";
import type { IEmailClient } from "@/infrastructure/resend/IEmailClient";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import type { ScheduleConfig, ZoomSession } from "@/domain/types";
import { FakeEmailClient } from "@/__tests__/fixtures/FakeEmailClient";

const mockScheduleSource = (
  overrides: Partial<ScheduleConfig> = {},
): IScheduleConfigSource => ({
  getConfig: jest.fn().mockResolvedValue({
    weeklyHours:             { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
    timezone:                "Europe/Madrid",
    minNoticeHours:          5,
    cancelMinNoticeHours:    2,
    joinOpenMinutesBefore:   15,
    tutorAbsentAlertMinutes: 5,
    bookingWindowWeeks:      8,
    ...overrides,
  }),
});

function svc(
  sessions: ISessionRepository,
  zoom: IZoomClient,
  tutorEmail: string,
  schedule: IScheduleConfigSource = mockScheduleSource(),
  email: IEmailClient = new FakeEmailClient(),
): SessionService {
  return new SessionService(sessions, zoom, tutorEmail, schedule, email);
}

const mockSessions = (): jest.Mocked<ISessionRepository> => ({
  createSession:         jest.fn(),
  findByEventId:         jest.fn(),
  deleteByEventId:       jest.fn(),
  markStudentJoined:     jest.fn().mockResolvedValue(undefined),
  markTutorJoined:       jest.fn().mockResolvedValue(undefined),
  claimTutorAbsentAlert: jest.fn().mockResolvedValue(true),
  appendChatMessage:     jest.fn(),
  listChatMessages:      jest.fn(),
  countChatMessages:     jest.fn(),
  resolveZoomSessionId:  jest.fn(),
  appendChatMessageById: jest.fn(),
  listChatMessagesById:  jest.fn(),
  countChatMessagesById: jest.fn(),
  broadcastChatMessage:  jest.fn().mockResolvedValue(undefined),
});

const mockZoom = (): jest.Mocked<IZoomClient> => ({
  generateSessionCredentials: jest.fn(),
  generateJWT:                jest.fn().mockReturnValue("signed-jwt"),
  getDurationWithGrace:       jest.fn().mockReturnValue(70),
});

const baseSession: ZoomSession = {
  sessionId:       "evt-1",
  sessionName:     "sess-abc",
  sessionPasscode: "pass123",
  studentEmail:    "alice@example.com",
  startIso:        "2026-05-01T10:00:00Z",
  durationMinutes: 60,
  sessionType:     "session1h",
};

describe("SessionService.issueJoinToken", () => {
  it("allows the tutor to join any session", async () => {
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, zoom, "tutor@example.com");
    const result  = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    });

    expect(result.token).toBe("signed-jwt");
    expect(zoom.generateJWT).toHaveBeenCalledWith(expect.objectContaining({ role: 1 }));
  });

  it("allows the assigned student to join", async () => {
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, zoom, "tutor@example.com");
    const result  = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(result.token).toBe("signed-jwt");
    expect(zoom.generateJWT).toHaveBeenCalledWith(expect.objectContaining({ role: 0 }));
  });

  it("rejects a non-participant trying to join", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "bob@example.com", userName: "Bob",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("allows tutor on legacy records without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession, studentEmail: "",
    });

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    })).resolves.toBeDefined();
  });

  it("rejects student on legacy records without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession, studentEmail: "",
    });

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("records student_joined_at when the student joins", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(sessions.markStudentJoined).toHaveBeenCalledWith("evt-1");
  });

  it("does NOT record student_joined_at when the tutor joins", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    });

    expect(sessions.markStudentJoined).not.toHaveBeenCalled();
  });

  it("still issues the token when markStudentJoined fails", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.markStudentJoined.mockRejectedValueOnce(new Error("DB down"));

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    const result  = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(result.token).toBe("signed-jwt");
  });

  it("throws BookingNotFoundError when session does not exist", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(null);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "missing", userEmail: "tutor@example.com", userName: "Tutor",
    })).rejects.toThrow(BookingNotFoundError);
  });
});

describe("SessionService.terminateSession", () => {
  it("delegates to repository deleteByEventId", async () => {
    const sessions = mockSessions();
    sessions.deleteByEventId.mockResolvedValue(undefined);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.terminateSession("evt-1");

    expect(sessions.deleteByEventId).toHaveBeenCalledWith("evt-1");
  });
});

describe("REFACTOR-P2-05: JWT lifetime", () => {
  it("passes durationSeconds >= session duration for a 2h session starting now", async () => {
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession,
      sessionType: "session2h",
      startIso:    new Date().toISOString(),
    });
    zoom.getDurationWithGrace.mockReturnValue(130);

    const service = svc(sessions, zoom, "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    const { durationSeconds } = zoom.generateJWT.mock.calls[0][0] as { durationSeconds: number };
    expect(durationSeconds).toBeGreaterThanOrEqual(130 * 60);
    expect(durationSeconds).toBeLessThanOrEqual(4 * 3600);
  });

  it("aligns expiresAt with durationSeconds within 1 second", async () => {
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession,
      sessionType: "session2h",
      startIso:    new Date().toISOString(),
    });
    zoom.getDurationWithGrace.mockReturnValue(130);

    const service   = svc(sessions, zoom, "tutor@example.com");
    const beforeSec = Math.floor(Date.now() / 1000);
    const result    = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    const { durationSeconds } = zoom.generateJWT.mock.calls[0][0] as { durationSeconds: number };
    expect(Math.abs(result.expiresAt - (beforeSec + durationSeconds))).toBeLessThanOrEqual(1);
  });

  it("clamps durationSeconds to 10 min floor when session ended long ago", async () => {
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession,
      sessionType: "session1h",
      startIso:    new Date(Date.now() - 2 * 3600_000).toISOString(), // started 2 h ago
    });
    zoom.getDurationWithGrace.mockReturnValue(70); // 70 min total

    const service = svc(sessions, zoom, "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    const { durationSeconds } = zoom.generateJWT.mock.calls[0][0] as { durationSeconds: number };
    expect(durationSeconds).toBe(600);
  });
});

describe("SessionService.postChatMessage", () => {
  it("rejects a non-participant sender", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.postChatMessage({
      eventId: "evt-1", senderEmail: "bob@example.com", senderName: "Bob", text: "hi",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("appends a message for an authorized sender", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);
    sessions.appendChatMessageById.mockResolvedValue(1);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    const result  = await service.postChatMessage({
      eventId: "evt-1", senderEmail: "alice@example.com", senderName: "Alice", text: "hello",
    });

    expect(result.messageId).toBe("evt-1:0");
    expect(sessions.appendChatMessageById).toHaveBeenCalledWith("zs-1", expect.stringContaining("hello"));
  });
});

describe("REFACTOR-P3-01: broadcast on post", () => {
  it("broadcasts the chat message after persistence", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);
    sessions.appendChatMessageById.mockResolvedValue(1);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.postChatMessage({
      eventId: "evt-1", senderEmail: "alice@example.com", senderName: "Alice", text: "hello",
    });

    expect(sessions.broadcastChatMessage).toHaveBeenCalledWith(
      "evt-1",
      expect.objectContaining({ text: "hello", senderEmail: "alice@example.com" }),
    );
  });

  it("does not fail postChatMessage if broadcast throws", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);
    sessions.appendChatMessageById.mockResolvedValue(1);
    sessions.broadcastChatMessage.mockRejectedValueOnce(new Error("network"));

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(
      service.postChatMessage({
        eventId: "evt-1", senderEmail: "alice@example.com", senderName: "Alice", text: "hello",
      }),
    ).resolves.toEqual({ messageId: "evt-1:0" });
  });
});

describe("REFACTOR-P3-02: query counts", () => {
  // Counts DB-touching repository calls. broadcastChatMessage is excluded — it's
  // a Realtime publish, not a query. The old eventId-based chat methods would
  // each re-resolve eventId → zoom_session_id, so they must not be called.
  it("postChatMessage uses 4 DB queries and no eventId re-resolution", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);
    sessions.appendChatMessageById.mockResolvedValue(1);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.postChatMessage({
      eventId: "evt-1", senderEmail: "alice@example.com", senderName: "Alice", text: "hi",
    });

    expect(sessions.findByEventId).toHaveBeenCalledTimes(1);
    expect(sessions.resolveZoomSessionId).toHaveBeenCalledTimes(1);
    expect(sessions.countChatMessagesById).toHaveBeenCalledTimes(1);
    expect(sessions.appendChatMessageById).toHaveBeenCalledTimes(1);

    const dbCalls =
      sessions.findByEventId.mock.calls.length +
      sessions.resolveZoomSessionId.mock.calls.length +
      sessions.countChatMessagesById.mock.calls.length +
      sessions.appendChatMessageById.mock.calls.length;
    expect(dbCalls).toBeLessThanOrEqual(4);

    expect(sessions.countChatMessages).not.toHaveBeenCalled();
    expect(sessions.appendChatMessage).not.toHaveBeenCalled();
    expect(sessions.listChatMessages).not.toHaveBeenCalled();
  });

  it("getChatMessages uses 4 DB queries and no eventId re-resolution", async () => {
    // REFACTOR-P3-04: getChatMessages now calls findByEventId once for the
    // membership check, on top of the P3-02 read path (resolve → count → list).
    // The N+1 guarantee still holds: resolveZoomSessionId is called once and the
    // old eventId-based chat methods are never touched.
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(2);
    sessions.listChatMessagesById.mockResolvedValue(["a", "b"]);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await service.getChatMessages({
      eventId: "evt-1", userEmail: "alice@example.com", fromIndex: 0,
    });

    expect(sessions.findByEventId).toHaveBeenCalledTimes(1);
    expect(sessions.resolveZoomSessionId).toHaveBeenCalledTimes(1);
    expect(sessions.countChatMessagesById).toHaveBeenCalledTimes(1);
    expect(sessions.listChatMessagesById).toHaveBeenCalledTimes(1);

    const dbCalls =
      sessions.findByEventId.mock.calls.length +
      sessions.resolveZoomSessionId.mock.calls.length +
      sessions.countChatMessagesById.mock.calls.length +
      sessions.listChatMessagesById.mock.calls.length;
    expect(dbCalls).toBeLessThanOrEqual(4);

    expect(sessions.countChatMessages).not.toHaveBeenCalled();
    expect(sessions.listChatMessages).not.toHaveBeenCalled();
  });
});

describe("REFACTOR-P3-04: chat membership check", () => {
  it("throws BookingNotFoundError for an unknown eventId", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(null);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.getChatMessages({
      eventId: "missing", userEmail: "alice@example.com", fromIndex: 0,
    })).rejects.toThrow(BookingNotFoundError);
  });

  it("throws UnauthorizedError when caller is not tutor or student", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.getChatMessages({
      eventId: "evt-1", userEmail: "bob@example.com", fromIndex: 0,
    })).rejects.toThrow(UnauthorizedError);
  });

  it("throws UnauthorizedError for a non-tutor on a legacy record without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({ ...baseSession, studentEmail: "" });

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.getChatMessages({
      eventId: "evt-1", userEmail: "bob@example.com", fromIndex: 0,
    })).rejects.toThrow(UnauthorizedError);
  });

  it("allows the assigned student (case-insensitive)", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.getChatMessages({
      eventId: "evt-1", userEmail: "ALICE@example.com", fromIndex: 0,
    })).resolves.toEqual({ messages: [], nextCursor: 0 });
  });

  it("allows the tutor", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.resolveZoomSessionId.mockResolvedValue("zs-1");
    sessions.countChatMessagesById.mockResolvedValue(0);

    const service = svc(sessions, mockZoom(), "tutor@example.com");
    await expect(service.getChatMessages({
      eventId: "evt-1", userEmail: "tutor@example.com", fromIndex: 0,
    })).resolves.toEqual({ messages: [], nextCursor: 0 });
  });
});

// ─── SESSION-JOIN-01 ──────────────────────────────────────────────────────────

describe("SessionService.issueJoinToken — classroom join window (SESSION-JOIN-01)", () => {
  const START = "2026-10-27T08:00:00.000Z";
  const session: ZoomSession = { ...baseSession, startIso: START, sessionType: "free15min" };

  afterEach(() => jest.useRealTimers());

  it("refuses the student before the classroom opens, without recording attendance", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-26T12:42:18Z") }); // the 2026-10-27 incident
    const sessions = mockSessions();
    const zoom     = mockZoom();
    sessions.findByEventId.mockResolvedValue(session);

    await expect(svc(sessions, zoom, "tutor@example.com").issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    })).rejects.toMatchObject({ code: "CLASSROOM_NOT_OPEN" });
    expect(sessions.markStudentJoined).not.toHaveBeenCalled();
    expect(zoom.generateJWT).not.toHaveBeenCalled();
  });

  it("lets the student in exactly when it opens (start − joinOpenMinutesBefore)", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T07:50:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);

    const result = await svc(
      sessions, mockZoom(), "tutor@example.com", mockScheduleSource({ joinOpenMinutesBefore: 10 }),
    ).issueJoinToken({ eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice" });

    expect(result.token).toBe("signed-jwt");
    expect(sessions.markStudentJoined).toHaveBeenCalledWith("evt-1");
    // Alert from start + tutorAbsentAlertMinutes (5 by default).
    expect(result.tutorAbsentAlertAt).toBe("2026-10-27T08:05:00.000Z");
  });

  it("one second before opening → still refused", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T07:49:59Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);

    await expect(svc(
      sessions, mockZoom(), "tutor@example.com", mockScheduleSource({ joinOpenMinutesBefore: 10 }),
    ).issueJoinToken({ eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice" }))
      .rejects.toMatchObject({ code: "CLASSROOM_NOT_OPEN" });
  });

  it("lets the tutor in at any time and records the tutor's join", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-26T12:00:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);

    const result = await svc(sessions, mockZoom(), "tutor@example.com").issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    });

    expect(result.token).toBe("signed-jwt");
    expect(result.tutorAbsentAlertAt).toBeNull();
    expect(sessions.markTutorJoined).toHaveBeenCalledWith("evt-1");
    expect(sessions.markStudentJoined).not.toHaveBeenCalled();
  });

  it("still issues the tutor's token when recording tutor_joined_at fails", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.markTutorJoined.mockRejectedValue(new Error("db down"));

    await expect(svc(sessions, mockZoom(), "tutor@example.com").issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    })).resolves.toMatchObject({ token: "signed-jwt" });
  });
});

describe("SessionService.reportTutorAbsent (SESSION-JOIN-01)", () => {
  const START = "2026-10-27T08:00:00.000Z";
  const session: ZoomSession = {
    ...baseSession,
    startIso:    START,
    sessionType: "free15min",
    studentName: "Alice",
    joinToken:   "a".repeat(64),
  };
  const report = (s: SessionService, userEmail = "alice@example.com") =>
    s.reportTutorAbsent({ eventId: "evt-1", userEmail });

  beforeEach(() => { process.env.NEXT_PUBLIC_BASE_URL = "https://gustavoai.dev"; });
  afterEach(() => jest.useRealTimers());

  it("emails the admin once the student has waited past start + M, with a classroom link", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:06:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);
    const email = new FakeEmailClient();

    const outcome = await report(svc(sessions, mockZoom(), "tutor@example.com", mockScheduleSource(), email));

    expect(outcome).toBe("sent");
    expect(sessions.claimTutorAbsentAlert).toHaveBeenCalledWith("evt-1");
    expect(email.sent).toEqual([{
      type: "tutorAbsentNotification",
      params: {
        studentEmail: "alice@example.com",
        studentName:  "Alice",
        sessionLabel: "Encuentro inicial gratuito · 15 min",
        startIso:     START,
        minutesLate:  5,
        joinUrl:      `https://gustavoai.dev/sesion/${"a".repeat(64)}`,
      },
    }]);
  });

  it("does nothing before start + M", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:04:59Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);
    const email = new FakeEmailClient();

    await expect(report(svc(sessions, mockZoom(), "tutor@example.com", mockScheduleSource(), email)))
      .resolves.toBe("too_early");
    expect(sessions.claimTutorAbsentAlert).not.toHaveBeenCalled();
    expect(email.sent).toHaveLength(0);
  });

  it("does nothing once the class (plus grace) is over", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T09:30:00Z") }); // grace mock = 70 min
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);

    await expect(report(svc(sessions, mockZoom(), "tutor@example.com"))).resolves.toBe("session_over");
    expect(sessions.claimTutorAbsentAlert).not.toHaveBeenCalled();
  });

  it("does nothing when the tutor has already joined", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:10:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({ ...session, tutorJoinedAt: "2026-10-27T07:58:00Z" });

    await expect(report(svc(sessions, mockZoom(), "tutor@example.com"))).resolves.toBe("tutor_joined");
    expect(sessions.claimTutorAbsentAlert).not.toHaveBeenCalled();
  });

  it("sends at most one email: a second report finds the alert already claimed", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:10:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);
    sessions.claimTutorAbsentAlert.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const email   = new FakeEmailClient();
    const service = svc(sessions, mockZoom(), "tutor@example.com", mockScheduleSource(), email);

    await expect(report(service)).resolves.toBe("sent");
    await expect(report(service)).resolves.toBe("already_sent");
    expect(email.sent).toHaveLength(1);
  });

  it("only the session's student may report", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:10:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);
    const service = svc(sessions, mockZoom(), "tutor@example.com");

    await expect(report(service, "mallory@example.com")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(report(service, "tutor@example.com")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws BookingNotFoundError for an unknown or no-longer-confirmed session", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(null);

    await expect(report(svc(sessions, mockZoom(), "tutor@example.com"))).rejects.toBeInstanceOf(BookingNotFoundError);
  });

  it("reports 'sent' even if the email fails (the claim stays, no retry storm)", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-27T08:10:00Z") });
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(session);
    const email = new FakeEmailClient();
    jest.spyOn(email, "sendTutorAbsentNotification").mockRejectedValue(new Error("resend down"));

    await expect(report(svc(sessions, mockZoom(), "tutor@example.com", mockScheduleSource(), email)))
      .resolves.toBe("sent");
  });
});
