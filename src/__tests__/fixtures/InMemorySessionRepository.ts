// TEST-01: In-memory implementation of ISessionRepository for integration tests.
import type { ISessionRepository } from "@/domain/repositories/ISessionRepository";
import type { ZoomSession } from "@/domain/types";

export class InMemorySessionRepository implements ISessionRepository {
  private sessions = new Map<string, ZoomSession>();
  private chats    = new Map<string, string[]>();

  async createSession(eventId: string, session: ZoomSession): Promise<void> {
    this.sessions.set(eventId, session);
  }

  async findByEventId(eventId: string): Promise<ZoomSession | null> {
    return this.sessions.get(eventId) ?? null;
  }

  async deleteByEventId(eventId: string): Promise<void> {
    this.sessions.delete(eventId);
    this.chats.delete(eventId);
  }

  async markStudentJoined(eventId: string): Promise<void> {
    const session = this.sessions.get(eventId);
    if (!session) return;
    if (session.studentJoinedAt) return; // first-join-only
    session.studentJoinedAt = new Date().toISOString();
  }

  async appendChatMessage(eventId: string, message: string): Promise<number> {
    const msgs = this.chats.get(eventId) ?? [];
    msgs.push(message);
    this.chats.set(eventId, msgs);
    return msgs.length - 1;
  }

  async listChatMessages(eventId: string, from: number, to: number): Promise<string[]> {
    const msgs = this.chats.get(eventId) ?? [];
    return msgs.slice(from, to + 1);
  }

  async countChatMessages(eventId: string): Promise<number> {
    return (this.chats.get(eventId) ?? []).length;
  }

  // REFACTOR-P3-01: in-memory tests don't exercise live delivery; no-op is
  // sufficient. Service-level tests that need to observe calls use jest mocks.
  async broadcastChatMessage(_eventId: string, _message: unknown): Promise<void> {
    /* no-op */
  }
}
