// ARCH-15: Unit tests for SessionService.
import { SessionService } from "../SessionService";
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { IZoomClient } from "@/infrastructure/zoom";
import { BookingNotFoundError, UnauthorizedError } from "@/domain/errors";
import type { ZoomSession } from "@/domain/types";

const mockSessions = (): jest.Mocked<ISessionRepository> => ({
  createSession:     jest.fn(),
  findByEventId:     jest.fn(),
  deleteByEventId:   jest.fn(),
  appendChatMessage: jest.fn(),
  listChatMessages:  jest.fn(),
  countChatMessages: jest.fn(),
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
