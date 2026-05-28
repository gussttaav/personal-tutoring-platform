// ARCH-15: Unit tests for SessionService.
import { SessionService } from "../SessionService";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IZoomClient } from "@/infrastructure/zoom";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import type { ZoomSession } from "@/domain/types";

const mockSessions = (): jest.Mocked<ISessionRepository> => ({
  createSession:      jest.fn(),
  findByEventId:      jest.fn(),
  deleteByEventId:    jest.fn(),
  markStudentJoined:  jest.fn().mockResolvedValue(undefined),
  appendChatMessage:  jest.fn(),
  listChatMessages:   jest.fn(),
  countChatMessages:  jest.fn(),
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

    const service = new SessionService(sessions, zoom, "tutor@example.com");
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

    const service = new SessionService(sessions, zoom, "tutor@example.com");
    const result  = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(result.token).toBe("signed-jwt");
    expect(zoom.generateJWT).toHaveBeenCalledWith(expect.objectContaining({ role: 0 }));
  });

  it("rejects a non-participant trying to join", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "bob@example.com", userName: "Bob",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("allows tutor on legacy records without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession, studentEmail: "",
    });

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    })).resolves.toBeDefined();
  });

  it("rejects student on legacy records without studentEmail", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue({
      ...baseSession, studentEmail: "",
    });

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("records student_joined_at when the student joins", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(sessions.markStudentJoined).toHaveBeenCalledWith("evt-1");
  });

  it("does NOT record student_joined_at when the tutor joins", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await service.issueJoinToken({
      eventId: "evt-1", userEmail: "tutor@example.com", userName: "Tutor",
    });

    expect(sessions.markStudentJoined).not.toHaveBeenCalled();
  });

  it("still issues the token when markStudentJoined fails", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.markStudentJoined.mockRejectedValueOnce(new Error("DB down"));

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    const result  = await service.issueJoinToken({
      eventId: "evt-1", userEmail: "alice@example.com", userName: "Alice",
    });

    expect(result.token).toBe("signed-jwt");
  });

  it("throws BookingNotFoundError when session does not exist", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(null);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.issueJoinToken({
      eventId: "missing", userEmail: "tutor@example.com", userName: "Tutor",
    })).rejects.toThrow(BookingNotFoundError);
  });
});

describe("SessionService.terminateSession", () => {
  it("delegates to repository deleteByEventId", async () => {
    const sessions = mockSessions();
    sessions.deleteByEventId.mockResolvedValue(undefined);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
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

    const service = new SessionService(sessions, zoom, "tutor@example.com");
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

    const service   = new SessionService(sessions, zoom, "tutor@example.com");
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

    const service = new SessionService(sessions, zoom, "tutor@example.com");
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

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    await expect(service.postChatMessage({
      eventId: "evt-1", senderEmail: "bob@example.com", senderName: "Bob", text: "hi",
    })).rejects.toThrow(UnauthorizedError);
  });

  it("appends a message for an authorized sender", async () => {
    const sessions = mockSessions();
    sessions.findByEventId.mockResolvedValue(baseSession);
    sessions.countChatMessages.mockResolvedValue(0);
    sessions.appendChatMessage.mockResolvedValue(1);

    const service = new SessionService(sessions, mockZoom(), "tutor@example.com");
    const result  = await service.postChatMessage({
      eventId: "evt-1", senderEmail: "alice@example.com", senderName: "Alice", text: "hello",
    });

    expect(result.messageId).toBe("evt-1:0");
    expect(sessions.appendChatMessage).toHaveBeenCalledWith("evt-1", expect.stringContaining("hello"));
  });
});
